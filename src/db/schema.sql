-- Martics D1 schema. Mirrors carest's "schema.sql + daily ALTERs" convention.
-- Apply with: wrangler d1 execute martics_db --file=./src/db/schema.sql

-- Community owner. Multi-tenant-ready; a single row is used for single-tenant runs.
CREATE TABLE IF NOT EXISTS influencers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  line_channel_id TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manually-assigned membership tiers (Bronze/Silver/Gold, etc.).
CREATE TABLE IF NOT EXISTS levels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  name          TEXT NOT NULL,
  rank          INTEGER NOT NULL DEFAULT 0,   -- 0 = lowest / default
  color         TEXT,
  perks         TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,   -- 0/1, the tier new members start in
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_levels_influencer ON levels(influencer_id);

-- Members: LINE users who followed the OA.
CREATE TABLE IF NOT EXISTS members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id    INTEGER NOT NULL REFERENCES influencers(id),
  line_user_id     TEXT NOT NULL,
  display_name     TEXT,
  picture_url      TEXT,
  level_id         INTEGER REFERENCES levels(id),
  status           TEXT NOT NULL DEFAULT 'active', -- active | blocked | left
  engagement_score INTEGER NOT NULL DEFAULT 0,
  joined_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at     TEXT,
  UNIQUE(influencer_id, line_user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_influencer ON members(influencer_id);
CREATE INDEX IF NOT EXISTS idx_members_level ON members(level_id);

-- Audit trail of every manual level change.
CREATE TABLE IF NOT EXISTS member_level_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     INTEGER NOT NULL REFERENCES members(id),
  from_level_id INTEGER,
  to_level_id   INTEGER,
  changed_by    TEXT,            -- admin identity (Cloudflare Access email)
  reason        TEXT,
  changed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mlh_member ON member_level_history(member_id);

-- Posts / announcements / exclusive content, optionally level-gated.
CREATE TABLE IF NOT EXISTS content (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id  INTEGER NOT NULL REFERENCES influencers(id),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  min_level_rank INTEGER NOT NULL DEFAULT 0, -- 0 = everyone
  published_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_influencer ON content(influencer_id);

CREATE TABLE IF NOT EXISTS content_reads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content(id),
  member_id  INTEGER NOT NULL REFERENCES members(id),
  read_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_id, member_id)
);

-- Broadcast send jobs.
CREATE TABLE IF NOT EXISTS broadcasts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id     INTEGER NOT NULL REFERENCES influencers(id),
  message           TEXT NOT NULL,
  audience          TEXT NOT NULL DEFAULT 'all', -- all | level | segment
  audience_level_id INTEGER REFERENCES levels(id),
  status            TEXT NOT NULL DEFAULT 'draft', -- draft|scheduled|sending|sent|failed
  scheduled_at      TEXT,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id),
  member_id    INTEGER NOT NULL REFERENCES members(id),
  delivered    INTEGER NOT NULL DEFAULT 0,
  read_at      TEXT,
  clicked_at   TEXT,
  UNIQUE(broadcast_id, member_id)
);

-- Raw engagement events feeding scores and rollups.
CREATE TABLE IF NOT EXISTS engagement_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL REFERENCES members(id),
  kind       TEXT NOT NULL, -- message_in|postback|content_open|link_click|follow|broadcast_read
  weight     INTEGER NOT NULL DEFAULT 1,
  meta       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_engagement_member ON engagement_events(member_id, created_at);

-- Daily per-member engagement rollup (cron-built), powers admin trends.
CREATE TABLE IF NOT EXISTS engagement_daily (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  day       TEXT NOT NULL, -- YYYY-MM-DD
  events    INTEGER NOT NULL DEFAULT 0,
  score     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(member_id, day)
);

-- Keyword auto-replies (carest pattern).
CREATE TABLE IF NOT EXISTS keyword_triggers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  keyword       TEXT NOT NULL,
  reply         TEXT NOT NULL,
  match_type    TEXT NOT NULL DEFAULT 'contains', -- contains | exact
  enabled       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_kw_influencer ON keyword_triggers(influencer_id);

-- Misc key/value settings (carest pattern).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Traffic log surfaced at admin /traffic (carest pattern).
CREATE TABLE IF NOT EXISTS api_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  route      TEXT NOT NULL,
  status     INTEGER,
  meta       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);

-- Cron telemetry (carest's recordCronRun).
CREATE TABLE IF NOT EXISTS cron_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job        TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 1,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_created ON cron_runs(created_at);
