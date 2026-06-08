/**
 * Broadcast service: resolve an audience, multicast in batches, and record
 * per-recipient delivery. Uses a KV lock so the every-minute cron never
 * double-sends a job (mirrors carest's reminder_locks idea).
 */

import type { Env, Broadcast, Member } from '../types';
import { multicast, chunk } from './line';
import { textMessage } from '../utils/flex';

/** Resolve the recipient members for a broadcast's audience definition. */
export async function resolveAudience(env: Env, b: Broadcast): Promise<Member[]> {
  if (b.audience === 'level' && b.audience_level_id) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM members WHERE influencer_id = ? AND level_id = ? AND status = 'active'`,
    )
      .bind(b.influencer_id, b.audience_level_id)
      .all<Member>();
    return results ?? [];
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM members WHERE influencer_id = ? AND status = 'active'`,
  )
    .bind(b.influencer_id)
    .all<Member>();
  return results ?? [];
}

/** Send one broadcast job. Idempotent via a short KV lock. */
export async function sendBroadcast(env: Env, b: Broadcast): Promise<number> {
  const lockKey = `bcast:${b.id}:lock`;
  if (await env.SESSION.get(lockKey)) return 0; // already in flight
  await env.SESSION.put(lockKey, '1', { expirationTtl: 300 });

  await env.DB.prepare(`UPDATE broadcasts SET status = 'sending' WHERE id = ?`).bind(b.id).run();

  const members = await resolveAudience(env, b);
  const messages = [textMessage(b.message)];
  let sent = 0;

  for (const batch of chunk(members, 500)) {
    const ids = batch.map((m) => m.line_user_id);
    const status = await multicast(env, ids, messages);
    if (status === 200) {
      sent += batch.length;
      const stmts = batch.map((m) =>
        env.DB.prepare(
          `INSERT INTO broadcast_recipients (broadcast_id, member_id, delivered)
           VALUES (?, ?, 1)
           ON CONFLICT(broadcast_id, member_id) DO UPDATE SET delivered = 1`,
        ).bind(b.id, m.id),
      );
      if (stmts.length) await env.DB.batch(stmts);
    }
  }

  await env.DB.prepare(`UPDATE broadcasts SET status = 'sent', sent_count = ? WHERE id = ?`)
    .bind(sent, b.id)
    .run();

  return sent;
}
