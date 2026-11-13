/**
 * Horários são armazenados como HH:mm em America/Sao_Paulo.
 * O Cron da Cloudflare dispara em UTC e nunca publica mensagens diretamente.
 */
export function saoPauloClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = type => parts.find(part => part.type === type)?.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  if (weekday < 0) throw new Error("Não foi possível obter o dia da semana em São Paulo.");
  return {
    weekday,
    localDate: get("year") + "-" + get("month") + "-" + get("day"),
    localTime: get("hour") + ":" + get("minute"),
  };
}

export function ruleIsDue(rule, clock) {
  if (!rule.enabled || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.local_time)) return false;
  let days;
  try { days = JSON.parse(rule.weekdays_json); } catch { return false; }
  return Array.isArray(days) && days.includes(clock.weekday) && rule.local_time <= clock.localTime;
}

/** D1 job idempotency is enforced by PK (owner_uid, rule_id, local_date). */
export function jobIdentity(rule, clock) {
  return [rule.owner_uid, rule.rule_id, clock.localDate].join(":");
}
