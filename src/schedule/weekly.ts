import type { OfferDraft } from "../offers/library";

export type Channel = "whatsapp" | "instagram";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const SCHEDULE_TIMEZONE = "America/Sao_Paulo";
export const MAX_RULES = 100;
export const WEEKDAYS: { id: Weekday; short: string; label: string }[] = [
  { id: 1, short: "Seg", label: "Segunda" },
  { id: 2, short: "Ter", label: "Terça" },
  { id: 3, short: "Qua", label: "Quarta" },
  { id: 4, short: "Qui", label: "Quinta" },
  { id: 5, short: "Sex", label: "Sexta" },
  { id: 6, short: "Sáb", label: "Sábado" },
  { id: 0, short: "Dom", label: "Domingo" },
];
export type WeeklyRule = {
  id: string;
  offerId: string;
  weekdays: Weekday[];
  time: string;
  channel: Channel;
  destinationLabel: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
export type WeeklyInput = Pick<WeeklyRule, "offerId" | "weekdays" | "time" | "channel" | "destinationLabel">;
export type Occurrence = {
  id: string;
  ruleId: string;
  offerId: string;
  offerTitle: string;
  channel: Channel;
  destinationLabel: string;
  date: string;
  time: string;
  due: boolean;
};

export const scheduleKey = (uid: string) => "affiliate-operator:weekly-schedule:v1:" + uid;

function validateWeekdays(value: unknown): value is Weekday[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 7
    && value.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(value).size === value.length;
}
function validateTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function isWeeklyRule(raw: unknown): raw is WeeklyRule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const rule = raw as Record<string, unknown>;
  return typeof rule.id === "string" && rule.id.length > 0 && rule.id.length <= 100
    && typeof rule.offerId === "string" && rule.offerId.length > 0 && rule.offerId.length <= 100
    && validateWeekdays(rule.weekdays) && validateTime(rule.time)
    && (rule.channel === "whatsapp" || rule.channel === "instagram")
    && typeof rule.destinationLabel === "string" && rule.destinationLabel.length <= 80
    && !/[\u0000-\u001F]/.test(rule.destinationLabel)
    && typeof rule.enabled === "boolean"
    && typeof rule.createdAt === "string" && Number.isFinite(Date.parse(rule.createdAt))
    && typeof rule.updatedAt === "string" && Number.isFinite(Date.parse(rule.updatedAt));
}
export function createWeeklyRule(input: WeeklyInput, offerIds: string[], id: string, now = new Date()): WeeklyRule {
  if (!offerIds.includes(input.offerId)) throw new Error("Escolha uma oferta cadastrada.");
  if (!validateWeekdays(input.weekdays)) throw new Error("Selecione pelo menos um dia da semana, sem repetições.");
  if (!validateTime(input.time)) throw new Error("Informe um horário válido.");
  if (input.channel !== "whatsapp" && input.channel !== "instagram") throw new Error("Canal inválido.");
  const destinationLabel = input.destinationLabel.trim();
  if (destinationLabel.length > 80 || /[\u0000-\u001F]/.test(destinationLabel)) {
    throw new Error("Destino inválido: máximo de 80 caracteres, sem quebras de linha.");
  }
  if (!id || id.length > 100) throw new Error("Identificador inválido.");
  const stamp = now.toISOString();
  return { id, offerId: input.offerId, weekdays: [...input.weekdays].sort((a, b) => a - b), time: input.time, channel: input.channel,
    destinationLabel, enabled: true, createdAt: stamp, updatedAt: stamp };
}
export function exportWeeklyRules(rules: WeeklyRule[]): string {
  return JSON.stringify({ version: 1, timezone: SCHEDULE_TIMEZONE, rules }, null, 2);
}
export function parseWeeklyRules(raw: string): WeeklyRule[] {
  if (raw.length > 250_000) throw new Error("Arquivo de agenda muito grande.");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("JSON da agenda inválido."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Backup da agenda inválido.");
  const doc = data as Record<string, unknown>;
  if (doc.version !== 1 || doc.timezone !== SCHEDULE_TIMEZONE || !Array.isArray(doc.rules)
    || doc.rules.length > MAX_RULES || !doc.rules.every(isWeeklyRule)) {
    throw new Error("Backup incompatível ou com regras inválidas.");
  }
  const ids = new Set(doc.rules.map(rule => rule.id));
  if (ids.size !== doc.rules.length) throw new Error("Há regras duplicadas no backup.");
  return doc.rules;
}

function saoPauloParts(when: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(when);
  const get = (key: string) => parts.find(part => part.type === key)?.value || "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), time: get("hour") + ":" + get("minute") };
}

/** Pure projection of a local planning calendar; DOES NOT SEND messages. */
export function upcomingOccurrences(rules: WeeklyRule[], offers: OfferDraft[], now = new Date(), days = 14): Occurrence[] {
  if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error("Período de projeção inválido.");
  const current = saoPauloParts(now);
  const currentDate = [current.year, String(current.month).padStart(2, "0"), String(current.day).padStart(2, "0")].join("-");
  const start = Date.UTC(current.year, current.month - 1, current.day, 12);
  const offerLookup = new Map(offers.map(offer => [offer.id, offer]));
  const result: Occurrence[] = [];
  for (let offset = 0; offset < days; offset++) {
    const d = new Date(start + offset * 86_400_000);
    const weekday = d.getUTCDay();
    const date = d.toISOString().slice(0, 10);
    for (const rule of rules) {
      if (!rule.enabled || !rule.weekdays.includes(weekday as Weekday)) continue;
      const offer = offerLookup.get(rule.offerId);
      if (!offer) continue; // A product might have been removed since this rule was saved.
      result.push({
        id: rule.id + ":" + date, ruleId: rule.id, offerId: offer.id, offerTitle: offer.title,
        channel: rule.channel, destinationLabel: rule.destinationLabel, date, time: rule.time,
        due: date < currentDate || (date === currentDate && rule.time <= current.time),
      });
    }
  }
  return result.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.ruleId.localeCompare(b.ruleId)).slice(0, 150);
}
