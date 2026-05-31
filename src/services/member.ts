/**
 * Member service: upsert on follow/message, engagement logging, level lookup.
 */

import type { Env, Member, Level, EngagementKind } from '../types';

const DEFAULT_INFLUENCER_ID = 1; // single-tenant default

/** Find a member by LINE user id, or null. */
export async function findMember(env: Env, lineUserId: string): Promise<Member | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM members WHERE influencer_id = ? AND line_user_id = ?`,
  )
    .bind(DEFAULT_INFLUENCER_ID, lineUserId)
    .first<Member>();
  return row ?? null;
}

/** Create a member (on follow) and assign the default level. */
export async function createMember(
  env: Env,
  lineUserId: string,
  displayName: string | null,
  pictureUrl: string | null,
): Promise<Member> {
  const defaultLevel = await env.DB.prepare(
    `SELECT * FROM levels WHERE influencer_id = ? AND is_default = 1 ORDER BY rank ASC LIMIT 1`,
  )
    .bind(DEFAULT_INFLUENCER_ID)
    .first<Level>();

  await env.DB.prepare(
    `INSERT INTO members (influencer_id, line_user_id, display_name, picture_url, level_id, last_seen_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(influencer_id, line_user_id) DO UPDATE SET
       display_name = excluded.display_name,
       picture_url  = excluded.picture_url,
       status       = 'active'`,
  )
    .bind(
      DEFAULT_INFLUENCER_ID,
      lineUserId,
      displayName,
      pictureUrl,
      defaultLevel?.id ?? null,
    )
    .run();

  const m = await findMember(env, lineUserId);
  return m as Member;
}

/** Ensure a member exists (used at message time if follow was missed). */
export async function ensureMember(
  env: Env,
  lineUserId: string,
  displayName: string | null,
  pictureUrl: string | null,
): Promise<Member> {
  const existing = await findMember(env, lineUserId);
  if (existing) return existing;
  return createMember(env, lineUserId, displayName, pictureUrl);
}

/** Resolve a member's level row. */
export async function getLevel(env: Env, levelId: number | null): Promise<Level | null> {
  if (!levelId) return null;
  const row = await env.DB.prepare(`SELECT * FROM levels WHERE id = ?`).bind(levelId).first<Level>();
  return row ?? null;
}

const WEIGHTS: Record<EngagementKind, number> = {
  message_in: 1,
  postback: 1,
  content_open: 2,
  link_click: 2,
  follow: 5,
  broadcast_read: 1,
};

/** Record an engagement event and bump the member's rolling score + last_seen. */
export async function logEngagement(
  env: Env,
  memberId: number,
  kind: EngagementKind,
  meta?: Record<string, unknown>,
): Promise<void> {
  const weight = WEIGHTS[kind] ?? 1;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO engagement_events (member_id, kind, weight, meta) VALUES (?, ?, ?, ?)`,
    ).bind(memberId, kind, weight, meta ? JSON.stringify(meta) : null),
    env.DB.prepare(
      `UPDATE members SET engagement_score = engagement_score + ?, last_seen_at = datetime('now') WHERE id = ?`,
    ).bind(weight, memberId),
  ]);
}

export { DEFAULT_INFLUENCER_ID };
