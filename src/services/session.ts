/**
 * KV-backed session + short conversation memory, mirroring carest's session
 * service. TTL-driven; no manual sweeps.
 */

import type { Env } from '../types';

const SESSION_TTL = 60 * 60 * 24; // 24h
const CHAT_TTL = 60 * 60 * 6; // 6h
const MAX_TURNS = 6;

export interface SessionState {
  state: string; // simple state-machine label, e.g. 'idle' | 'awaiting_feedback'
  data?: Record<string, unknown>;
}

export async function getSession(env: Env, uid: string): Promise<SessionState> {
  const raw = await env.SESSION.get(`session:${uid}`);
  return raw ? (JSON.parse(raw) as SessionState) : { state: 'idle' };
}

export async function setSession(env: Env, uid: string, s: SessionState): Promise<void> {
  await env.SESSION.put(`session:${uid}`, JSON.stringify(s), { expirationTtl: SESSION_TTL });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function getChat(env: Env, uid: string): Promise<ChatTurn[]> {
  const raw = await env.SESSION.get(`chat:${uid}`);
  return raw ? (JSON.parse(raw) as ChatTurn[]) : [];
}

export async function appendChat(env: Env, uid: string, turn: ChatTurn): Promise<ChatTurn[]> {
  const turns = await getChat(env, uid);
  turns.push(turn);
  const trimmed = turns.slice(-MAX_TURNS);
  await env.SESSION.put(`chat:${uid}`, JSON.stringify(trimmed), { expirationTtl: CHAT_TTL });
  return trimmed;
}
