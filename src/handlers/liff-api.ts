/**
 * LIFF-facing JSON endpoints called from the in-LINE webviews (web/ Pages).
 * The webview sends the LIFF access token; we verify it against LINE, then
 * return profile / level data. Kept dependency-free.
 */

import type { Env } from '../types';
import { findMember, getLevel } from '../services/member';
import { logApi } from '../services/log';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

/** Verify a LIFF access token and return the LINE userId, or null. */
async function verifyLiffToken(accessToken: string): Promise<string | null> {
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const p = (await res.json()) as { userId: string };
  return p.userId ?? null;
}

export async function handleLiffApi(req: Request, env: Env, path: string): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const uid = await verifyLiffToken(auth);
  if (!uid) {
    await logApi(env, path, 401);
    return json({ error: 'unauthorized' }, 401);
  }

  if (path === '/api/profile-card') {
    const member = await findMember(env, uid);
    if (!member) return json({ error: 'not_found' }, 404);
    const level = await getLevel(env, member.level_id);
    await logApi(env, path, 200);
    return json({
      displayName: member.display_name,
      pictureUrl: member.picture_url,
      engagementScore: member.engagement_score,
      joinedAt: member.joined_at,
      level: level ? { name: level.name, color: level.color, perks: level.perks } : null,
    });
  }

  await logApi(env, path, 404);
  return json({ error: 'unknown_endpoint' }, 404);
}
