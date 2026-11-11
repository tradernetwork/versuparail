# versuparail

Single-page, read-only status dashboard for Vercel, Railway and Supabase. It currently watches one target app, TraderDaddy Pro, with the project, team and environment IDs set in `.env`. Product spec: `PLAN.md`. Working notes for contributors and agents: `CLAUDE.md`.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000, or: npm run dev -- -p <port>
npm run build
npm run lint
```

There is no test suite yet.

## Configuration

Server-side only, read from `.env` (gitignored, never commit it):

| Variable | Used for |
|---|---|
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_NAME`, `VERCEL_TEAM_ID`, `VERCEL_TEAM_SLUG` | Vercel status |
| `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID` | Railway status |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` | Supabase project health |

## How it works

`app/api/{vercel,railway,supabase}/route.ts` each return the `ProviderStatus` shape from `lib/types.ts`. A provider failure comes back as `overall: 'unknown'` with an error string and HTTP 200, so one outage does not blank the page. `components/Dashboard.tsx` polls all three every 60 seconds, with a manual Refresh button.

Token scopes, expiry dates and known gaps are in `CLAUDE.md`.
