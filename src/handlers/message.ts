/**
 * Handles inbound LINE text messages:
 *   1. ensure the member exists, log engagement
 *   2. keyword triggers (DB) → quick replies
 *   3. built-in commands (level / profile)
 *   4. fall back to a level-aware Claude reply
 */

import type { Env } from '../types';
import { reply, getProfile } from '../services/line';
import { ensureMember, getLevel, logEngagement, DEFAULT_INFLUENCER_ID } from '../services/member';
import { getChat, appendChat } from '../services/session';
import { ask } from '../services/claude';
import { textMessage, levelCardMessage, profileButtonMessage } from '../utils/flex';

export async function handleTextMessage(
  env: Env,
  lineUserId: string,
  text: string,
  replyToken: string,
): Promise<void> {
  // Resolve member (fetch profile lazily if we have to create one).
  let member = await ensureMember(env, lineUserId, null, null);
  if (!member.display_name) {
    const p = await getProfile(env, lineUserId);
    if (p) member = await ensureMember(env, lineUserId, p.displayName, p.pictureUrl ?? null);
  }

  await logEngagement(env, member.id, 'message_in', { text });

  const lower = text.trim().toLowerCase();

  // Built-in commands.
  if (lower === 'level' || lower === 'my level' || lower.includes('ระดับ')) {
    const level = await getLevel(env, member.level_id);
    await reply(env, replyToken, [levelCardMessage(member.display_name ?? '', level)]);
    return;
  }
  if (lower === 'profile' || lower.includes('โปรไฟล์')) {
    const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;
    await reply(env, replyToken, [profileButtonMessage(liffUrl)]);
    return;
  }

  // DB keyword triggers.
  const { results } = await env.DB.prepare(
    `SELECT keyword, reply, match_type FROM keyword_triggers
     WHERE influencer_id = ? AND enabled = 1`,
  )
    .bind(DEFAULT_INFLUENCER_ID)
    .all<{ keyword: string; reply: string; match_type: string }>();

  for (const t of results ?? []) {
    const hit =
      t.match_type === 'exact' ? lower === t.keyword.toLowerCase() : lower.includes(t.keyword.toLowerCase());
    if (hit) {
      await reply(env, replyToken, [textMessage(t.reply)]);
      return;
    }
  }

  // Fallback: Claude, with a touch of level context.
  const level = await getLevel(env, member.level_id);
  const history = await getChat(env, lineUserId);
  const levelHint = level ? `\n[Member level: ${level.name}. Perks: ${level.perks ?? 'n/a'}.]` : '';
  const answer = await ask(env, history, text + levelHint);

  await appendChat(env, lineUserId, { role: 'user', content: text });
  await appendChat(env, lineUserId, { role: 'assistant', content: answer });

  await reply(env, replyToken, [textMessage(answer)]);
}
