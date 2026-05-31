/**
 * LINE Messaging API service: reply, push, multicast, and profile fetch.
 * Wraps the REST endpoints the Worker needs; mirrors carest's line service.
 */

import type { Env } from '../types';

const API = 'https://api.line.me/v2/bot';

function headers(env: Env) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

/** Reply to an event using its replyToken (free, must be prompt). */
export async function reply(env: Env, replyToken: string, messages: unknown[]) {
  await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ replyToken, messages }),
  });
}

/** Push to a single user. */
export async function push(env: Env, to: string, messages: unknown[]) {
  await fetch(`${API}/message/push`, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ to, messages }),
  });
}

/**
 * Multicast to up to 500 users per call (LINE limit). Caller chunks the list.
 * Returns the HTTP status so the broadcast job can record success/failure.
 */
export async function multicast(env: Env, to: string[], messages: unknown[]): Promise<number> {
  const res = await fetch(`${API}/message/multicast`, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ to, messages }),
  });
  return res.status;
}

/** Fetch a follower's display name + picture. */
export async function getProfile(
  env: Env,
  userId: string,
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const res = await fetch(`${API}/profile/${userId}`, { headers: headers(env) });
  if (!res.ok) return null;
  return (await res.json()) as { displayName: string; pictureUrl?: string };
}

/** Split an array into chunks of `size` (for multicast batching). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
