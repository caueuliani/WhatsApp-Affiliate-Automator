-- Cloudflare D1: estado persistente do operador e fila auditável.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS offers (
  owner_uid TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_uid, offer_id)
);

CREATE TABLE IF NOT EXISTS weekly_rules (
  owner_uid TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  weekdays_json TEXT NOT NULL,
  local_time TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram')),
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_uid, rule_id),
  FOREIGN KEY (owner_uid, offer_id) REFERENCES offers(owner_uid, offer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weekly_rules_enabled
ON weekly_rules(enabled, owner_uid);

CREATE TABLE IF NOT EXISTS schedule_jobs (
  owner_uid TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram')),
  local_time TEXT NOT NULL,
  offer_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','completed_manually','skipped')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_uid, rule_id, local_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_jobs_operator_status
ON schedule_jobs(owner_uid, status, local_date);

CREATE TABLE IF NOT EXISTS operator_revisions (
  owner_uid TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  saved_at TEXT NOT NULL
);
