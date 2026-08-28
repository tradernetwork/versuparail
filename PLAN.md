# Ops Dashboard Plan — Vercel + Supabase + Railway

A single internal page that shows deploy/health status across all three
services at a glance, so you don't have to tab-hop between three dashboards.

## Goal

Read-only, single-page view answering: "is everything up, what deployed last,
and is the database healthy?" Not a replacement for any provider's dashboard —
just the cross-cutting summary none of them give you.

## Stack

- **Next.js (App Router)**, deployed on Vercel itself — free tier, zero infra to manage.
- Server-side API routes call each provider's API using secret tokens (never exposed to the client).
- No database of its own — everything is fetched live (with short in-memory/edge caching, ~30–60s) from the three providers' APIs.

## Data sources & what to pull

| Provider | API | Data to show |
|---|---|---|
| Vercel | REST API (`api.vercel.com`), token-based | Latest deployment per project: status (ready/building/error), commit, branch, timestamp; env var count (not values) |
| Supabase | Management API (`api.supabase.com`) + direct Postgres connection | Project status/region, DB size, active connections, recent Postgres logs/errors, auth user count |
| Railway | Public GraphQL API (`backboard.railway.app/graphql/v2`) | Per-service: latest deployment status, build/deploy logs summary, replica health |

## Auth & secrets

- One read-scoped API token per provider, stored as Vercel env vars on the dashboard project itself:
  `VERCEL_API_TOKEN`, `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`, `RAILWAY_API_TOKEN`.
- Dashboard itself sits behind Vercel's built-in password protection (or a simple shared-secret middleware) since it surfaces infra status — don't leave it publicly reachable.
- Tokens are read-only/minimally scoped where each provider's API supports it.
  - Railway has no read-only scope on the public API — the narrowest available option is a
    **project token** (`projectTokenCreate`), scoped to one project + environment, vs. an
    account-wide personal token. Use a project token per monitored project.

## First real target: TraderDaddy Pro

Confirmed by reading `~/projects/TraderDaddy-Pro---Whop` — this is the app the dashboard
should monitor first; the stack matches the plan exactly (Railway + Vercel + Supabase, no
changes to the "Stack" section above needed).

- **Railway** — workspace "Artur Vorojeykin's Projects" (shared, not solely mph's), project
  `traderdaddypro-options` (ID `901bec7e-9780-4e02-a224-99fcf2bf1b78`), production environment
  (ID `d0043073-9798-4899-8a8e-6811ca5e4bb8`). Services to show:
  - `TraderDaddy-Pro---Whop` — backend API, https://api.traderdaddy.pro (online)
  - `avatar-shield` (online), `traderdaddy-flow-bot` (offline)
  - Redis (`redis-volume`, online)
  - CLI (`railway`) is already authenticated on this box as mphinance@gmail.com and can see
    this project plus two others (`alpha-command-center` in the same workspace,
    `strikeforge` under Michael H's own workspace) — worth deciding whether v1 monitors just
    TraderDaddy or all three.
- **Supabase** — project ref `wynnwfnrhckocovjfsky` (`aws-1-us-east-2` pooler), production DB
  for the backend (`DATABASE_URL` in `backend/.env.tpl`, resolved from 1Password).
- **Vercel** — frontend auto-deploys from `main` per `LAUNCH-CUTOVER.md`; no `.vercel/project.json`
  exists in the local checkout, so the exact project/team slug isn't confirmed yet — grab it from
  the Vercel dashboard or `vercel link` inside `frontend/`.
- Secrets in this repo are managed via 1Password (`backend/.env.tpl`, vault "TraderDaddy Pro")
  and pushed to Railway with `railway variables --set`. None of those app secrets (Stripe,
  Discord, Tradier, etc.) are needed for this dashboard — it only needs the three
  read/deploy-status API tokens above, which are a different kind of credential (ops-dashboard
  access, not app runtime config).

## Pages / layout

- Single page, three cards side by side (stacks on mobile):
  - **Vercel card** — one row per project, status pill, last deploy time, link out to the real dashboard.
  - **Supabase card** — status pill, DB size, connection count, last error from logs (if any).
  - **Railway card** — one row per service, status pill, last deploy time.
- Top of page: an overall "all green" / "attention needed" banner rolling up all three.
- Every card links out to the provider's real dashboard for the deep dive — this page is a triage view, not a replacement.

## Build steps

1. Scaffold Next.js app, deploy an empty shell to Vercel, put it behind password protection.
2. Vercel integration: API route + card (self-referential — the dashboard can report on its own deploys too).
3. Supabase integration: API route + card.
4. Railway integration: API route + card.
5. Unify into one page with the status banner; add manual refresh + auto-poll (~60s).
6. Polish: loading/error states per card so one provider's API hiccup doesn't blank the whole page.

## Explicitly out of scope (v1)

- Historical trends/charts (this is a live snapshot tool, not observability).
- Alerting/notifications — if you want paging, that's a job for Better Stack/Checkly, not this.
- Write actions (redeploy, restart, rollback) — read-only to start; could add later behind explicit confirmation.
