import "dotenv/config";
import express from "express";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { createServer as createViteServer } from "vite";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json";
import { authorizedEmails, checkSendThrottle, isAuthorized, validateOffer } from "./src/server/validation";

const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
if (projectId !== firebaseConfig.projectId) {
  throw new Error("FIREBASE_PROJECT_ID difere do projectId do aplicativo Web. Confira as configurações antes de iniciar.");
}
initializeApp({ projectId });
const firebaseAuth = getAuth();
const allowed = authorizedEmails(process.env.AUTHORIZED_EMAILS);
if (!allowed.size) console.warn("AUTHORIZED_EMAILS vazio: acesso ao sistema bloqueado.");

const PORT = Number(process.env.PORT || 3000);
const AUTH_DIR = path.resolve(process.env.WHATSAPP_AUTH_DIR || "./.wa-auth");
const sessions = new Map<string, ReturnType<typeof makeWASocket>>();
const qrs = new Map<string, string>();
const connected = new Set<string>();
const connecting = new Set<string>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const busy = new Set<string>();
const sendHistory = new Map<string, number[]>();

type OperatorRequest = express.Request & { operator?: { uid: string; email: string } };

async function connectWhatsApp(uid: string): Promise<void> {
  if (sessions.has(uid) || connecting.has(uid)) return;
  connecting.add(uid);
  try {
    await mkdir(path.join(AUTH_DIR, uid), { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_DIR, uid));
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "warn" }) as any,
      browser: ["Affiliate Operator", "Chrome", "1.0"],
    });
    sessions.set(uid, sock);
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async update => {
      if (update.qr) {
        try { qrs.set(uid, await QRCode.toDataURL(update.qr)); } catch { qrs.delete(uid); }
      }
      if (update.connection === "open") {
        connected.add(uid);
        qrs.delete(uid);
      } else if (update.connection === "close") {
        const loggedOut = (update.lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;
        if (sessions.get(uid) !== sock) return;
        sessions.delete(uid);
        connected.delete(uid);
        qrs.delete(uid);
        if (!loggedOut && !reconnectTimers.has(uid)) {
          const timer = setTimeout(() => {
            reconnectTimers.delete(uid);
            void connectWhatsApp(uid).catch(error => console.error("Reconexão falhou:", error));
          }, 5000);
          reconnectTimers.set(uid, timer);
        }
      }
    });
  } finally {
    connecting.delete(uid);
  }
}

async function main(): Promise<void> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  const requireOperator: express.RequestHandler = async (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith("Bearer ")) {
      res.status(401).json({ error: "Faça login para continuar." });
      return;
    }
    try {
      const user = await firebaseAuth.verifyIdToken(bearer.slice(7));
      if (!isAuthorized(user.email, user.email_verified, allowed)) {
        res.status(403).json({ error: "Sua conta não está autorizada a utilizar esta ferramenta." });
        return;
      }
      (req as OperatorRequest).operator = { uid: user.uid, email: user.email! };
      next();
    } catch {
      res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/me", requireOperator, (req, res) => {
    res.json({ email: (req as OperatorRequest).operator!.email });
  });
  app.get("/api/status", requireOperator, async (req, res) => {
    const uid = (req as OperatorRequest).operator!.uid;
    try {
      await connectWhatsApp(uid);
      res.json({ connected: connected.has(uid) });
    } catch (error) {
      console.error("Erro de conexão:", error);
      res.status(503).json({ error: "Não foi possível iniciar a conexão do WhatsApp." });
    }
  });
  app.get("/api/qr", requireOperator, (req, res) => {
    const uid = (req as OperatorRequest).operator!.uid;
    if (connected.has(uid)) {
      res.status(409).json({ error: "WhatsApp já conectado." });
      return;
    }
    const qr = qrs.get(uid);
    if (!qr) {
      res.status(404).json({ error: "QR Code ainda não disponível." });
      return;
    }
    res.json({ qr });
  });
  app.get("/api/grupos", requireOperator, async (req, res) => {
    const uid = (req as OperatorRequest).operator!.uid;
    const sock = sessions.get(uid);
    if (!connected.has(uid) || !sock) {
      res.status(503).json({ error: "WhatsApp desconectado." });
      return;
    }
    try {
      const groups = await sock.groupFetchAllParticipating();
      res.json(Object.values(groups).map(group => ({ id: group.id, nome: group.subject })));
    } catch {
      res.status(502).json({ error: "Falha ao buscar os grupos." });
    }
  });
  app.post("/api/share", requireOperator, async (req, res) => {
    const uid = (req as OperatorRequest).operator!.uid;
    let offer;
    try {
      offer = validateOffer(req.body);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Oferta inválida." });
      return;
    }
    const sock = sessions.get(uid);
    if (!connected.has(uid) || !sock) {
      res.status(503).json({ error: "WhatsApp desconectado." });
      return;
    }
    if (busy.has(uid)) {
      res.status(429).json({ error: "Aguarde o envio atual terminar." });
      return;
    }
    const now = Date.now();
    const recent = (sendHistory.get(uid) || []).filter(ts => ts > now - 3600000);
    const throttle = checkSendThrottle(recent, now);
    if (!throttle.allowed) {
      res.set("Retry-After", String(throttle.retryAfterSeconds));
      res.status(429).json({ error: "Limite de envios manuais atingido. Tente novamente em " + throttle.retryAfterSeconds + " segundos." });
      return;
    }
    busy.add(uid);
    try {
      const groups = await sock.groupFetchAllParticipating();
      if (!Object.prototype.hasOwnProperty.call(groups, offer.grupoId)) {
        res.status(403).json({ error: "Grupo não encontrado entre os participantes da conta." });
        return;
      }
      sendHistory.set(uid, [...recent, Date.now()]);
      await sock.sendMessage(offer.grupoId, { text: offer.text });
      res.json({ accepted: true, message: "Solicitação aceita pelo WhatsApp. A entrega não é garantida." });
    } catch (error) {
      console.error("Falha de envio:", error);
      res.status(502).json({ error: "Falha ao solicitar o envio. Verifique o grupo e a conexão." });
    } finally {
      busy.delete(uid);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log("Servidor iniciado na porta " + PORT));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
