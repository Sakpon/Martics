/**
 * Anthropic Claude service. Haiku by default, Sonnet for heavier asks —
 * same two-tier setup as carest. The system prompt is hot-reloadable from KV
 * (config:companion_prompt) so ops can tune tone without a deploy.
 */

import type { Env } from '../types';
import type { ChatTurn } from './session';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

interface AskOptions {
  strong?: boolean;
  systemOverride?: string;
  maxTokens?: number;
}

export async function ask(
  env: Env,
  history: ChatTurn[],
  userText: string,
  opts: AskOptions = {},
): Promise<string> {
  const system =
    opts.systemOverride ??
    (await env.SESSION.get('config:companion_prompt')) ??
    'You are a friendly community assistant for a LINE creator community. Be warm and concise.';

  const model = opts.strong ? env.CLAUDE_MODEL_STRONG : env.CLAUDE_MODEL;

  const messages = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: userText },
  ];

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 512,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    return "Sorry, I couldn't process that right now. Please try again.";
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === 'text')?.text;
  return text?.trim() || 'OK!';
}
