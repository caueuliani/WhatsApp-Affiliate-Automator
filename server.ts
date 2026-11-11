import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin for Token Verification
initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0126630129" });

const adminAuth = getAuth();
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0126630129";
const DATABASE_ID = "ai-studio-whatsappaffiliat-a485c61f-1427-4cf4-acdf-7a5e74dd052f";

// --- SAAS STATE MANAGEMENT ---
const sessions = new Map<string, ReturnType<typeof makeWASocket>>();
const currentQrs = new Map<string, string>();
const isConnectedMap = new Map<string, boolean>();

type BulkJobStatus = "running" | "completed" | "error";
interface BulkJob {
  id: string;
  userId: string;
  total: number;
  current: number;
  status: BulkJobStatus;
  logs: string[];
}
const bulkJobs = new Map<string, BulkJob>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => sleep(Math.floor(Math.random() * (max - min + 1) + min) * 1000);

async function connectToWhatsApp(userId: string) {
  if (sessions.has(userId)) return;

  const { state, saveCreds } = await useMultiFileAuthState(`baileys_auth_info_${userId}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }) as any,
    browser: ["WhatsApp SaaS", "Chrome", "1.0.0"],
  });

  sessions.set(userId, sock);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrBase64 = await QRCode.toDataURL(qr);
      currentQrs.set(userId, qrBase64);
      isConnectedMap.set(userId, false);
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      
      isConnectedMap.set(userId, false);
      sessions.delete(userId);
      currentQrs.delete(userId);
      
      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(userId), 2000);
      } else {
        console.log(`User ${userId} logged out. Credentials invalid.`);
      }
    } else if (connection === "open") {
      console.log(`User ${userId} connected to WhatsApp`);
      isConnectedMap.set(userId, true);
      currentQrs.delete(userId);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

async function runBulkJob(jobId: string, userId: string, numbers: string[], finalMessage: string) {
  const job = bulkJobs.get(jobId);
  const sock = sessions.get(userId);
  if (!job || !sock) return;

  for (let i = 0; i < numbers.length; i++) {
    if (!isConnectedMap.get(userId)) {
      job.status = "error";
      job.logs.push("❌ Erro: WhatsApp desconectado durante o envio.");
      break;
    }

    const rawNumber = numbers[i].replace(/\D/g, "");
    if (!rawNumber) {
      job.current = i + 1;
      job.logs.push(`⚠️ Ignorado: Número inválido (linha ${i + 1})`);
      continue;
    }

    const jid = `${rawNumber}@s.whatsapp.net`;

    try {
      await sock.sendMessage(jid, { text: finalMessage });
      job.logs.push(`✅ Enviado para ${rawNumber}`);
    } catch (error) {
      job.logs.push(`❌ Erro ao enviar para ${rawNumber}`);
    }

    job.current = i + 1;
    if (i < numbers.length - 1) await randomDelay(5, 15);
  }

  if (job.status !== "error") {
    job.status = "completed";
    job.logs.push("🎉 Finalizado!");
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === AUTH & DB MIDDLEWARE ===
  const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    
    const token = authHeader.split('Bearer ')[1];
    if (token === 'anti-sleep-ping') return next(); // Bypass for internal ping

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      
      const adminEmail = process.env.ADMIN_EMAIL || "caueuliani@gmail.com";
      const isAdmin = decodedToken.email?.toLowerCase() === adminEmail.toLowerCase();

      // Fetch user document via Firestore REST API using the user's own token
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${decodedToken.uid}`;
      const docRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      
      let status = "inactive";
      let trialEndsAt = null;

      if (docRes.ok) {
        const data = await docRes.json();
        if (data.fields) {
          status = data.fields.status?.stringValue || "inactive";
          trialEndsAt = data.fields.trialEndsAt?.integerValue ? parseInt(data.fields.trialEndsAt.integerValue) : null;
        }
      }

      (req as any).user = { 
        ...decodedToken, 
        status,
        trialEndsAt,
        isAdmin 
      };
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  const requireSubscription = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) return next(); // Allow bypass (like the ping)
    if (user.isAdmin) return next();
    
    if (user.status === 'active') return next();
    if (user.status === 'trial' && user.trialEndsAt && user.trialEndsAt > Date.now()) return next();
    
    return res.status(403).json({ error: "Access denied. Subscription required or trial expired." });
  };

  // WhatsApp Routes
  app.get("/api/status", authenticateUser, requireSubscription, (req, res) => {
    const user = (req as any).user;
    if (!user) return res.json({ connected: false }); // Bypass
    
    const userId = user.uid;
    if (!sessions.has(userId)) {
      connectToWhatsApp(userId).catch(console.error);
    }
    const connected = isConnectedMap.get(userId) || false;
    res.json({ connected });
  });

  app.get("/api/qr", authenticateUser, requireSubscription, (req, res) => {
    const userId = (req as any).user.uid;
    const connected = isConnectedMap.get(userId) || false;
    
    if (connected) return res.status(400).json({ error: "Already connected" });
    
    const qr = currentQrs.get(userId);
    if (!qr) return res.status(404).json({ error: "QR not generated yet or loading" });
    
    res.json({ qr });
  });

  app.get("/api/grupos", authenticateUser, requireSubscription, async (req, res) => {
    const userId = (req as any).user.uid;
    const sock = sessions.get(userId);
    const connected = isConnectedMap.get(userId) || false;

    try {
      if (!connected || !sock) return res.status(400).json({ error: "WhatsApp não está conectado" });
      const groupMetaData = await sock.groupFetchAllParticipating();
      const grupos = Object.values(groupMetaData).map(grupo => ({ id: grupo.id, nome: grupo.subject }));
      res.json(grupos);
    } catch (error) {
      res.status(500).json({ error: "Falha ao buscar a lista de grupos" });
    }
  });

  app.post("/api/share", authenticateUser, requireSubscription, async (req, res) => {
    const userId = (req as any).user.uid;
    const { link, grupoId, mensagem } = req.body;
    const sock = sessions.get(userId);
    const connected = isConnectedMap.get(userId) || false;

    if (!connected || !sock) return res.status(503).json({ error: "WhatsApp not connected" });
    if (!grupoId || !mensagem) return res.status(400).json({ error: "Missing required fields" });

    try {
      const finalMessage = link ? `${mensagem}\n\n${link}` : mensagem;
      const formattedJid = grupoId.includes("@") ? grupoId : `${grupoId}@g.us`;
      await sock.sendMessage(formattedJid, { text: finalMessage });
      res.json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/bulk-share", authenticateUser, requireSubscription, (req, res) => {
    const userId = (req as any).user.uid;
    const { numbers, link, mensagem } = req.body;
    const sock = sessions.get(userId);
    const connected = isConnectedMap.get(userId) || false;

    if (!connected || !sock) return res.status(503).json({ error: "WhatsApp not connected" });
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0 || !mensagem) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const finalMessage = link ? `${mensagem}\n\n${link}` : mensagem;
    const jobId = `${userId}_${Date.now()}`;
    
    bulkJobs.set(jobId, { id: jobId, userId, total: numbers.length, current: 0, status: "running", logs: ["🚀 Iniciando disparo em lote..."] });
    runBulkJob(jobId, userId, numbers, finalMessage).catch(console.error);
    res.json({ jobId });
  });

  app.get("/api/bulk-status/:jobId", authenticateUser, requireSubscription, (req, res) => {
    const userId = (req as any).user.uid;
    const job = bulkJobs.get(req.params.jobId);
    if (!job || job.userId !== userId) return res.status(404).json({ error: "Job not found or access denied" });
    res.json(job);
  });

  setInterval(() => {
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    fetch(`${appUrl}/api/status`, { headers: { 'Authorization': 'Bearer anti-sleep-ping' } }).catch(() => {});
  }, 10 * 60 * 1000);

  // === VITE MIDDLEWARE ===
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
