/** Lightweight traffic + cron telemetry writers (carest's api_logs / cron_runs). */

import type { Env } from '../types';

export async function logApi(
  env: Env,
  route: string,
  status: number,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await env.DB.prepare(`INSERT INTO api_logs (route, status, meta) VALUES (?, ?, ?)`)
      .bind(route, status, meta ? JSON.stringify(meta) : null)
      .run();
  } catch {
    // never let logging break a request
  }
}

export async function recordCronRun(
  env: Env,
  job: string,
  ok: boolean,
  detail?: string,
): Promise<void> {
  try {
    await env.DB.prepare(`INSERT INTO cron_runs (job, ok, detail) VALUES (?, ?, ?)`)
      .bind(job, ok ? 1 : 0, detail ?? null)
      .run();
  } catch {
    // ignore
  }
}
