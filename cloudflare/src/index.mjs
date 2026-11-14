import { saoPauloClock, ruleIsDue } from "./scheduler.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function reject(status, message) { return json({ error: message }, status); }
const safeId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const validateOffer = offer => {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return false;
  if (!safeId(offer.id) || typeof offer.title !== "string" || !offer.title.trim() || offer.title.length > 120) return false;
  if (typeof offer.message !== "string" || !offer.message.trim() || offer.message.length > 3000) return false;
  if (typeof offer.link !== "string" || offer.link.length > 2048) return false;
  if (offer.link) {
    try { if (new URL(offer.link).protocol !== "https:") return false; }
    catch { return false; }
  }
  if (offer.priceCents !== null && (!Number.isSafeInteger(offer.priceCents) || offer.priceCents < 0 || offer.priceCents > 100_000_000)) return false;
  if (!timestamp(offer.createdAt) || !timestamp(offer.updatedAt)) return false;
  if (offer.plannedAt !== null && !timestamp(offer.plannedAt)) return false;
  if (offer.affiliateProgram !== undefined && !["mercado_livre","shopee","amazon","other"].includes(offer.affiliateProgram)) return false;
  if (offer.trackingLabel !== undefined && (typeof offer.trackingLabel !== "string" || offer.trackingLabel.length > 60)) return false;
  return true;
};
const validateRule = (rule, offers) => {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  if (!safeId(rule.id) || !safeId(rule.offerId) || !offers.has(rule.offerId)) return false;
  if (!Array.isArray(rule.weekdays) || rule.weekdays.length < 1 || rule.weekdays.length > 7) return false;
  if (!rule.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) || new Set(rule.weekdays).size !== rule.weekdays.length) return false;
  if (typeof rule.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) return false;
  if (!["whatsapp","instagram"].includes(rule.channel) || typeof rule.enabled !== "boolean") return false;
  if (typeof rule.destinationLabel !== "string" || rule.destinationLabel.length > 80) return false;
  if (!timestamp(rule.createdAt) || !timestamp(rule.updatedAt)) return false;
  return true;
};

function validateState(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.offers) || !Array.isArray(body.rules)) return false;
  if (body.offers.length > 100 || body.rules.length > 100) return false;
  if (!body.offers.every(validateOffer)) return false;
  const offerIds = new Set(body.offers.map(offer => offer.id));
  if (offerIds.size !== body.offers.length || !body.rules.every(rule => validateRule(rule, offerIds))) return false;
  return new Set(body.rules.map(rule => rule.id)).size === body.rules.length;
}

async function readBody(request, maximum = 200_000) {
  const body = await request.text();
  if (body.length > maximum) throw new Error("Payload excede limite.");
  return JSON.parse(body);
}

function tokenIsValid(request, secret) {
  if (typeof secret !== "string" || secret.length < 32) return false;
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return false;
  const candidate = value.slice(7);
  if (candidate.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= candidate.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function loadState(db, uid) {
  const [offers, rules, version] = await Promise.all([
    db.prepare("SELECT payload_json FROM offers WHERE owner_uid = ? ORDER BY updated_at DESC LIMIT 100").bind(uid).all(),
    db.prepare("SELECT payload_json FROM weekly_rules WHERE owner_uid = ? ORDER BY updated_at DESC LIMIT 100").bind(uid).all(),
    db.prepare("SELECT revision FROM operator_revisions WHERE owner_uid = ?").bind(uid).first(),
  ]);
  return {
    offers: offers.results.map(row => JSON.parse(row.payload_json)),
    rules: rules.results.map(row => JSON.parse(row.payload_json)),
    revision: version?.revision ?? 0,
  };
}

async function saveState(db, uid, body) {
  const expectedRevision = body?.expectedRevision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return reject(428, "Revisão da nuvem obrigatória. Atualize o backup antes de enviar.");
  }
  if (!validateState(body)) return reject(400, "Biblioteca ou agenda inválida.");

  // Transaction-scoped nonce identifies the one request that acquired the CAS revision.
  // Every data operation is guarded by this nonce; stale requests are no-ops, not deletes.
  // D1 batch is one SQLite transaction. This avoids any read-then-write race.
  const nonce = crypto.randomUUID();
  const stamp = new Date().toISOString();
  const activeWrite = "EXISTS (SELECT 1 FROM operator_revisions WHERE owner_uid = ? AND write_token = ?)";
  const steps = [
    // First upload: the row does not exist. Only base revision 0 may create it.
    db.prepare(
      "INSERT OR IGNORE INTO operator_revisions(owner_uid,revision,saved_at,write_token) SELECT ?,1,?,? WHERE ?=0"
    ).bind(uid, stamp, nonce, expectedRevision),
    // Subsequent uploads: advance ONLY if the revision still equals the client's base.
    db.prepare(
      "UPDATE operator_revisions SET revision=revision+1,saved_at=?,write_token=? WHERE owner_uid=? AND revision=?"
    ).bind(stamp, nonce, uid, expectedRevision),
    db.prepare(
      "DELETE FROM weekly_rules WHERE owner_uid=? AND " + activeWrite
    ).bind(uid, uid, nonce),
    db.prepare(
      "DELETE FROM offers WHERE owner_uid=? AND " + activeWrite
    ).bind(uid, uid, nonce),
    ...body.offers.map(offer => db.prepare(
      "INSERT INTO offers(owner_uid,offer_id,payload_json,updated_at) SELECT ?,?,?,? WHERE " + activeWrite
    ).bind(uid, offer.id, JSON.stringify(offer), offer.updatedAt, uid, nonce)),
    ...body.rules.map(rule => db.prepare(
      "INSERT INTO weekly_rules(owner_uid,rule_id,offer_id,weekdays_json,local_time,channel,enabled,payload_json,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE " + activeWrite
    ).bind(uid, rule.id, rule.offerId, JSON.stringify(rule.weekdays), rule.time, rule.channel,
      rule.enabled ? 1 : 0, JSON.stringify(rule), rule.updatedAt, uid, nonce)),
  ];
  const results = await db.batch(steps);
  const claims = (results[0]?.meta?.changes ?? 0) + (results[1]?.meta?.changes ?? 0);
  if (claims !== 1) {
    const current = await db.prepare("SELECT revision FROM operator_revisions WHERE owner_uid = ?").bind(uid).first();
    return json({
      error: "Conflito: o backup na nuvem mudou em outro dispositivo. Nenhum dado foi sobrescrito. Atualize a revisão antes de tentar novamente.",
      currentRevision: current?.revision ?? 0,
    }, 409);
  }
  return json({ ok: true, revision: expectedRevision + 1 });
}

async function listJobs(db, uid) {
  const rows = await db.prepare(
    "SELECT rule_id,local_date,offer_id,channel,local_time,offer_snapshot_json,status,created_at,updated_at FROM schedule_jobs WHERE owner_uid = ? ORDER BY local_date DESC,local_time DESC LIMIT 100"
  ).bind(uid).all();
  return json({
    jobs: rows.results.map(row => ({
      ruleId: row.rule_id, localDate: row.local_date,
      offerId: row.offer_id, channel: row.channel, localTime: row.local_time,
      offer: JSON.parse(row.offer_snapshot_json), status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))
  });
}

async function markJob(db, uid, request) {
  let body;
  try { body = await readBody(request, 5_000); }
  catch { return reject(400, "JSON inválido."); }
  if (!safeId(body.ruleId) || typeof body.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.localDate)
    || !["completed_manually","skipped"].includes(body.status)) return reject(400, "Status ou ocorrência inválidos.");
  const result = await db.prepare(
    "UPDATE schedule_jobs SET status=?,updated_at=? WHERE owner_uid=? AND rule_id=? AND local_date=? AND status='pending_review'"
  ).bind(body.status, new Date().toISOString(), uid, body.ruleId, body.localDate).run();
  if (result.meta?.changes !== 1) return reject(409, "Ocorrência não encontrada ou já finalizada.");
  return json({ ok: true });
}

export async function runSchedule(db, now = new Date()) {
  const clock = saoPauloClock(now);
  const current = await db.prepare(
    "SELECT r.owner_uid,r.rule_id,r.offer_id,r.weekdays_json,r.local_time,r.channel,r.enabled,o.payload_json FROM weekly_rules r JOIN offers o ON o.owner_uid=r.owner_uid AND o.offer_id=r.offer_id WHERE r.enabled=1 ORDER BY r.owner_uid,r.rule_id LIMIT 500"
  ).all();
  const stamp = now.toISOString();
  const commands = current.results.filter(rule => ruleIsDue(rule, clock)).map(rule => db.prepare(
    "INSERT OR IGNORE INTO schedule_jobs(owner_uid,rule_id,local_date,offer_id,channel,local_time,offer_snapshot_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending_review',?,?)"
  ).bind(rule.owner_uid,rule.rule_id,clock.localDate,rule.offer_id,rule.channel,rule.local_time,rule.payload_json,stamp,stamp));
  // D1 batch mantém este conjunto atômico e reduz round-trips; chave composta evita duplicatas.
  const writes = commands.length ? await db.batch(commands) : [];
  const added = writes.reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);
  return { scanned: current.results.length, added, clock };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "affiliate-operator-scheduler" });
    if (!tokenIsValid(request, env.INTERNAL_API_TOKEN)) return reject(401, "Unauthorized.");
    const uid = request.headers.get("x-operator-uid");
    if (!safeId(uid)) return reject(400, "Invalid operator.");
    if (!env.DB) return reject(503, "Database binding missing.");
    try {
      if (url.pathname === "/internal/state" && request.method === "GET") return json(await loadState(env.DB, uid));
      if (url.pathname === "/internal/state" && request.method === "PUT") {
        let body;
        try { body = await readBody(request); } catch { return reject(400, "JSON inválido ou muito grande."); }
        return await saveState(env.DB, uid, body);
      }
      if (url.pathname === "/internal/jobs" && request.method === "GET") return await listJobs(env.DB, uid);
      if (url.pathname === "/internal/jobs/mark" && request.method === "POST") return await markJob(env.DB, uid, request);
      return reject(404, "Not found.");
    } catch (error) {
      console.error("D1 request failed", error instanceof Error ? error.name : "unknown");
      return reject(503, "Storage service unavailable.");
    }
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(runSchedule(env.DB).then(({ scanned, added }) => {
      console.log("schedule scan", { scanned, added });
    }));
  }
};
