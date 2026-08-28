@AGENTS.md

# versuparail — cross-provider ops dashboard

Single-page, read-only status dashboard for Vercel + Railway + Supabase. See `PLAN.md` for the
full product spec. Currently monitors exactly one target app, TraderDaddy Pro
(`~/projects/TraderDaddy-Pro---Whop`), via project/team/environment IDs hardcoded into `.env` —
not yet generalized to monitor multiple apps.

## Run / build

- `npm run dev` — dev server, default port 3000. If that's in use, pass `-- -p <port>`.
- `npm run build` / `npm run lint` — both must pass clean before calling a change done.
- No test suite yet.
- Not deployed yet. Plan: deploy to Vercel, then turn on native **Password Protection** in the
  Vercel project settings (Pro plan already covers this) — do NOT build custom auth middleware,
  that was deliberately skipped in favor of the platform feature.

## Architecture

- `lib/types.ts` — the `ProviderStatus`/`ServiceItem` contract every `/api/*` route must return.
  Routes never throw or 500 — a provider failure becomes `overall: 'unknown'` + an `error`
  string, HTTP 200, so one provider's outage never blanks the whole page.
- `app/api/{vercel,railway,supabase}/route.ts` — one server-side integration per provider, using
  the tokens in `.env`.
- `components/Dashboard.tsx` — client component, polls all three routes every 60s + manual
  Refresh button.
- `components/ProviderCard.tsx` / `StatusPill.tsx` — shared rendering, provider-agnostic.

## Secrets (`.env`, gitignored)

Three provider tokens, each named `versuparail-ops-dashboard` on the provider side so they're
identifiable/revocable. All were deliberately scoped as narrowly as each provider allowed —
don't casually swap in a broader token:

- `RAILWAY_API_TOKEN` — **account-scoped** (not project-scoped). A narrower project token was
  attempted first and rejected server-side: mph is a member, not admin, on the Railway workspace
  ("Artur Vorojeykin's Projects") that owns the monitored project. Minting Railway tokens via
  CLI/Bash gets blocked by Claude Code's own permission classifier — create/rotate via the
  dashboard (railway.app/account/tokens) instead.
- `VERCEL_API_TOKEN` — project-scoped (`trader-daddy-pro-whop-frontend` only), 90-day expiry,
  created 2026-08-27 → **expires 2026-11-25**.
- `SUPABASE_ACCESS_TOKEN` — project-scoped + read-only preset (`traderdaddyoptionswhop-production`
  only), 90-day expiry, created 2026-08-27 → **expires ~2026-11-25**. It has no DB credentials,
  so DB size/connection-count/logs (in `PLAN.md`'s wishlist) are NOT implemented — the Supabase
  card only reflects project-level health from the Management API.

When any of these expire, regenerate through the same dashboard flow with the same scoping
(project-level + read-only where offered), update `.env`, and re-verify with a plain curl against
each provider's API before trusting the UI again.

## Known gaps vs. PLAN.md

- Supabase card: no DB size, connection count, or log tailing (see above).
- Single hardcoded target (TraderDaddy Pro) — the plan's cross-project vision isn't built.
- No deploy yet, no password protection turned on yet.

