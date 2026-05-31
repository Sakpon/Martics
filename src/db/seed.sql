-- Seed data for local dev / first deploy. Single-tenant baseline.
-- Apply with: wrangler d1 execute martics_db --file=./src/db/seed.sql

INSERT INTO influencers (id, name, line_channel_id)
VALUES (1, 'Demo Creator', NULL)
ON CONFLICT(id) DO NOTHING;

-- Three default tiers; rank 0 is the default new members land in.
INSERT INTO levels (influencer_id, name, rank, color, perks, is_default) VALUES
  (1, 'Bronze', 0, '#CD7F32', 'Community access', 1),
  (1, 'Silver', 1, '#C0C0C0', 'Early announcements', 0),
  (1, 'Gold',   2, '#FFD700', 'Exclusive content + Q&A', 0);

INSERT INTO keyword_triggers (influencer_id, keyword, reply, match_type, enabled) VALUES
  (1, 'hello', 'Welcome to the community! Type "menu" to see what you can do.', 'contains', 1),
  (1, 'menu',  'Available: my level · browse content · profile.', 'contains', 1);

INSERT INTO settings (key, value) VALUES
  ('companion_prompt', 'You are the friendly community assistant for a LINE creator community. Be warm, concise, and helpful. Encourage members to engage. Reply in the member''s language.')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
