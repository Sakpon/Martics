/**
 * Martics Worker entry — mirrors carest's index.ts shape:
 *   fetch handler      → /webhook, /api/*, /test-*, /cron/health
 *   scheduled handler  → every-minute cron jobs
 */

import type { Env } from './types';
import { handleWebhook } from './handlers/webhook';
import { handleLiffApi } from './handlers/liff-api';
import { runCron } from './cron';
import { recordCronRun } from './services/log';

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // LINE webhook.
    if (path === '/webhook' && req.method === 'POST') {
      return handleWebhook(req, env);
    }

    // LIFF JSON API.
    if (path.startsWith('/api/')) {
      return handleLiffApi(req, env, path);
    }

    // Cron liveness (last tick + recent failures).
    if (path === '/cron/health') {
      const last = await env.DB.prepare(
        `SELECT job, ok, detail, created_at FROM cron_runs ORDER BY id DESC LIMIT 10`,
      ).all();
      return Response.json({ ok: true, recent: last.results });
    }

    // Test endpoints (carest convention) — fire a single cron job on demand.
    if (path === '/test-cron') {
      await runCron(env);
      return new Response('cron ran', { status: 200 });
    }

    if (path === '/') {
      return new Response('Martics worker is running.', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runCron(env).catch((err) => recordCronRun(env, 'tick', false, String(err))),
    );
  },
};
