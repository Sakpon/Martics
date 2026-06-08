# CLAUDE.md — Martics

Guidance for working in this repo.

## What this is
LINE community platform for creators/influencers. Members belong to **manually
assigned levels**. Tech architecture mirrors the **carest** project.

## Stack
- **Worker** (`src/`, TypeScript): LINE webhook + LIFF API + every-minute cron.
- **D1** `martics_db`: relational store (`src/db/schema.sql`).
- **KV** `SESSION`: sessions, short chat context, broadcast locks, hot Claude prompt.
- **web/** Astro + Tailwind (Pages, static) — landing + LIFF.
- **admin/** Astro SSR (`@astrojs/cloudflare`) — admin portal behind Cloudflare Access.
- **Claude**: Haiku 4.5 default, Sonnet 4.6 strong (`src/services/claude.ts`).

## Conventions (kept from carest)
- Schema lives in `schema.sql` (all `IF NOT EXISTS`). Additive changes go one-per-line
  in `src/db/migrations.sql`, applied on deploy with `|| true`.
- Cron runs every minute; each job is wrapped with `recordCronRun` telemetry.
- All inbound webhook + LIFF requests log to `api_logs` (surfaced at admin `/traffic`).
- The Claude system prompt is hot-reloadable from KV key `config:companion_prompt`.
- Single-tenant runtime (`DEFAULT_INFLUENCER_ID = 1`) but schema is multi-tenant-ready.

## Commands
- `npm run type-check` — Worker tsc (CI gate).
- `npm run db:apply:local` / `db:seed:local` — local D1 setup.
- `npm run dev` — `wrangler dev`.

## Key files
- `src/index.ts` — fetch + scheduled entry.
- `src/handlers/webhook.ts` — signature verify + event routing.
- `src/handlers/message.ts` — keyword triggers, commands, Claude fallback.
- `src/services/` — `line`, `claude`, `session`, `member`, `broadcast`, `log`.
- `src/cron/index.ts` — scheduled jobs.
- `admin/src/pages/members/[id].astro` — the manual level-assignment workflow.

## Guardrails
- Never commit secrets; use `.dev.vars` locally and `wrangler secret put` / GitHub secrets.
- Verify LINE signatures before processing (`src/utils/signature.ts`).
- Keep the webhook fast and always return 200 to LINE.
