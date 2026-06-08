# Martics

A **LINE-native community platform** that lets a creator/influencer communicate with
and engage their members across **levels (tiers)** — announcements, exclusive content,
and segmented broadcasts, all inside the LINE app.

The tech architecture deliberately mirrors the **carest** project: a Cloudflare
Worker bot backed by D1 + KV, an Astro web/LIFF site, and an Astro-SSR admin portal
behind Cloudflare Access, with every-minute cron and path-filtered GitHub Actions.

## Architecture

```
LINE (Messaging API webhook/push + LIFF)  ──▶  Cloudflare Worker "martics" (src/)
                                                   ├─ fetch:     /webhook /api/* /cron/health /test-*
                                                   └─ scheduled: every minute (broadcasts, rollup, win-back, digest)
                                                          │
                                          ┌───────────────┴───────────────┐
                                   D1 "martics_db"                    KV "SESSION"
                              (members, levels, broadcasts,      (session, chat ctx,
                               content, engagement, logs)         locks, hot prompt)

Astro Pages "martics-web"   → landing + LIFF (/profile) + /audit (AIO citation audit)
Astro SSR  "martics-admin"  → dashboard, members, levels, content, broadcast, traffic
                              (gated by Cloudflare Access)
```

## AIO citation audit (`/audit` on martics.co)

A self-contained tool that measures how often Google's AI Overview cites
**martics.co** for a list of search prompts (Thailand locale) and which competitors
get cited instead — exports to Excel/CSV. It lives on the `martics-web` Pages project:

- `web/public/audit/index.html` → served at `/audit/`.
- `web/functions/audit/api/aio.js` → `POST /audit/api/aio`, a Pages Function that
  calls **SerpApi** server-side (key stays secret) and returns the parsed result.
- `web/functions/audit/_middleware.js` → **HTTP Basic Auth** gate scoped to the
  `/audit/*` subtree, so the public landing/LIFF pages stay open.

Set these on the **martics-web** Pages project (Settings → Environment variables):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SERPAPI_API_KEY` | yes | — | Mark as a **secret**. |
| `AUDIT_TARGET` | no | `martics.co` | Domain to measure citation for. |
| `BASIC_AUTH_USERNAME` | no | `martics` | Login user for `/audit`. |
| `BASIC_AUTH_PASSWORD` | **yes** | — | No default — `/audit` returns 503 until set. Set a strong value. |

Local preview: `cd web && SERPAPI_API_KEY=… BASIC_AUTH_PASSWORD=… npx wrangler pages dev dist`
(after `npm run build`). To use Cloudflare Access instead of Basic Auth, delete
`_middleware.js` and add an Access policy on the `/audit` path.

## Layout

| Path | What |
|---|---|
| `src/` | Worker: `index.ts`, `handlers/`, `services/`, `cron/`, `db/`, `utils/` |
| `web/` | Astro + Tailwind static site & LIFF views |
| `admin/` | Astro SSR admin (Cloudflare adapter, Cloudflare Access) |
| `wrangler.toml` | Worker config (D1 + KV bindings, cron trigger) |
| `.github/workflows/` | `ci.yml`, `deploy.yml`, `deploy-web.yml`, `deploy-admin.yml` |

## Member levels

Levels are **manually assigned by the influencer** in the admin portal
(`/members/[id]`). Every change is written to `member_level_history` with the
acting admin's Cloudflare Access email and an optional reason. Engagement is still
tracked (`engagement_events` → `engagement_daily`) to inform those manual decisions
and to drive inactivity win-back.

## Local development

```bash
# Worker
npm install
cp .dev.vars.example .dev.vars   # fill in secrets
npm run db:apply:local && npm run db:seed:local
npm run dev                      # wrangler dev

# Web / Admin
cd web && npm install && npm run dev
cd admin && npm install && npm run dev
```

## Deploy / setup

1. Create resources:
   ```bash
   npx wrangler d1 create martics_db        # put the id in wrangler.toml (root + admin)
   npx wrangler kv namespace create SESSION # put the id in wrangler.toml
   ```
2. Set Worker secrets:
   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put CLAUDE_API_KEY
   npx wrangler secret put LIFF_ID
   ```
3. Add GitHub repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Point the LINE OA webhook at `https://martics.<account>.workers.dev/webhook`.
5. Gate `martics-admin.pages.dev` with a Cloudflare Access policy.

Pushes to `main` deploy automatically (path-filtered): the Worker workflow applies
`schema.sql`, runs additive `migrations.sql` statements with `|| true`, then deploys.
