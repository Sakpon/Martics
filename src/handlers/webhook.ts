/**
 * LINE webhook entry: verify signature, then route each event.
 * follow → create member + welcome; message → message handler; postback → log.
 */

import type { Env } from '../types';
import { verifyLineSignature } from '../utils/signature';
import { reply, getProfile } from '../services/line';
import { createMember, ensureMember, logEngagement } from '../services/member';
import { handleTextMessage } from './message';
import { textMessage } from '../utils/flex';
import { logApi } from '../services/log';

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
}

export async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const raw = await req.text();
  const sig = req.headers.get('x-line-signature');

  const valid = await verifyLineSignature(raw, sig, env.LINE_CHANNEL_SECRET);
  if (!valid) {
    await logApi(env, '/webhook', 401);
    return new Response('Bad signature', { status: 401 });
  }

  const body = JSON.parse(raw) as { events?: LineEvent[] };
  const events = body.events ?? [];

  // Process events; never block the 200 LINE expects.
  for (const ev of events) {
    try {
      await routeEvent(env, ev);
    } catch (err) {
      await logApi(env, '/webhook', 500, { error: String(err), type: ev.type });
    }
  }

  await logApi(env, '/webhook', 200, { count: events.length });
  return new Response('OK', { status: 200 });
}

async function routeEvent(env: Env, ev: LineEvent): Promise<void> {
  const uid = ev.source?.userId;
  if (!uid) return;

  switch (ev.type) {
    case 'follow': {
      const p = await getProfile(env, uid);
      const member = await createMember(env, uid, p?.displayName ?? null, p?.pictureUrl ?? null);
      await logEngagement(env, member.id, 'follow');
      if (ev.replyToken) {
        await reply(env, ev.replyToken, [
          textMessage(
            `Welcome${p?.displayName ? `, ${p.displayName}` : ''}! 🎉 You're now part of the community. Type "menu" to get started.`,
          ),
        ]);
      }
      break;
    }

    case 'message': {
      if (ev.message?.type === 'text' && ev.replyToken) {
        await handleTextMessage(env, uid, ev.message.text ?? '', ev.replyToken);
      }
      break;
    }

    case 'postback': {
      const member = await ensureMember(env, uid, null, null);
      await logEngagement(env, member.id, 'postback', { data: ev.postback?.data });
      break;
    }

    case 'unfollow': {
      await env.DB.prepare(
        `UPDATE members SET status = 'left' WHERE line_user_id = ?`,
      )
        .bind(uid)
        .run();
      break;
    }

    default:
      break;
  }
}
