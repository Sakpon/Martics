/**
 * Scheduled handler — runs every minute (carest cadence). Each job is wrapped
 * with recordCronRun telemetry so /cron/health and admin can see liveness.
 */

import type { Env } from '../types';
import { recordCronRun } from '../services/log';
import { sendBroadcast } from '../services/broadcast';
import type { Broadcast } from '../types';
import { push } from '../services/line';
import { textMessage } from '../utils/flex';

export async function runCron(env: Env): Promise<void> {
  await safe(env, 'scheduledBroadcasts', () => checkScheduledBroadcasts(env));
  await safe(env, 'engagementRollup', () => checkEngagementRollup(env));
  await safe(env, 'inactivityWinback', () => checkInactivityWinback(env));
  await safe(env, 'influencerDigest', () => checkInfluencerDigest(env));
  await recordCronRun(env, 'tick', true);
}

async function safe(env: Env, job: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    await recordCronRun(env, job, true);
  } catch (err) {
    await recordCronRun(env, job, false, String(err));
  }
}

/** Fire any scheduled broadcasts whose time has come. */
async function checkScheduledBroadcasts(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM broadcasts
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')
     LIMIT 10`,
  ).all<Broadcast>();
  for (const b of results ?? []) {
    await sendBroadcast(env, b);
  }
}

/** Roll today's engagement_events into engagement_daily (idempotent upsert). */
async function checkEngagementRollup(env: Env): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO engagement_daily (member_id, day, events, score)
     SELECT member_id, date('now') AS day, COUNT(*) AS events, SUM(weight) AS score
     FROM engagement_events
     WHERE date(created_at) = date('now')
     GROUP BY member_id
     ON CONFLICT(member_id, day) DO UPDATE SET events = excluded.events, score = excluded.score`,
  ).run();
}

/** Nudge members idle > 14 days, at most once a day (guarded by KV key). */
async function checkInactivityWinback(env: Env): Promise<void> {
  const guard = `winback:${new Date().toISOString().slice(0, 10)}`;
  if (await env.SESSION.get(guard)) return;
  // Only run this once per day, near the top of the hour to spread load.
  const now = new Date();
  if (!(now.getUTCMinutes() === 0 && now.getUTCHours() === 9)) return;
  await env.SESSION.put(guard, '1', { expirationTtl: 60 * 60 * 25 });

  const { results } = await env.DB.prepare(
    `SELECT line_user_id FROM members
     WHERE status = 'active'
       AND (last_seen_at IS NULL OR last_seen_at <= datetime('now', '-14 days'))
     LIMIT 100`,
  ).all<{ line_user_id: string }>();

  for (const m of results ?? []) {
    await push(env, m.line_user_id, [
      textMessage('We miss you! 👋 Come check the latest from the community — type "menu".'),
    ]);
  }
}

/** Daily summary push to the influencer's own LINE id (if configured). */
async function checkInfluencerDigest(env: Env): Promise<void> {
  const now = new Date();
  if (!(now.getUTCMinutes() === 0 && now.getUTCHours() === 8)) return;

  const opsId = await env.SESSION.get('config:ops_line_id');
  if (!opsId) return;

  const stats = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM members WHERE status='active') AS active,
       (SELECT COUNT(*) FROM members WHERE date(joined_at)=date('now','-1 day')) AS new_yesterday,
       (SELECT COUNT(*) FROM engagement_events WHERE date(created_at)=date('now','-1 day')) AS events_yesterday`,
  ).first<{ active: number; new_yesterday: number; events_yesterday: number }>();

  await push(env, opsId, [
    textMessage(
      `📊 Daily digest\nActive members: ${stats?.active ?? 0}\nNew yesterday: ${stats?.new_yesterday ?? 0}\nEngagement events: ${stats?.events_yesterday ?? 0}`,
    ),
  ]);
}
