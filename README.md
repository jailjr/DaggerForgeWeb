# DaggerForge Web

DaggerForge Web is a responsive Daggerheart campaign workspace based on the upstream [Torutu/daggerforge](https://github.com/Torutu/daggerforge) content and terminology. The production app runs as one Render web service: the Node API serves the built Vite client, uses hosted Postgres when `DATABASE_URL` is present, and exposes campaign-scoped SSE realtime updates.

## Local development

Node.js 20+ is recommended (the production Docker image and CI use Node 20).

```bash
npm ci
npm run dev:full
```

In a second terminal, run `npm run dev` and open `http://localhost:5173`. Vite uses the development API at `http://127.0.0.1:8787`; the server falls back to `data/campaigns.json` only when `DATABASE_URL` is not configured. Development-only seed data is kept in the client for visual work. Production always requires a real server campaign and API state.

## Verification

```bash
npm test                 # unit and API integration tests
npm run build            # typecheck and production bundle
npx playwright install   # once per machine
npm run test:browser     # browser workflows and mobile navigation
```

The browser suite starts the API and Vite dev server automatically. CI also builds the Docker image and runs Chromium tests.

## Product capabilities

- PREPARATION and PLAY campaign modes with server-enforced permissions.
- GM creation and campaign-scoped access; player join links with nickname and persistent participant identity.
- Character creation, finalization, Daggerheart traits, experiences, domain cards, equipment, inventory, runtime tracks, private notes, derived values, optimistic concurrency, and audit history.
- GM Library browsing for Daggerheart base content plus guided campaign forms for adversaries, environments, items, and encounter templates.
- Independent encounter instantiation, persistent Fear and adversary state, environment details, auditable adversary actions, sessions, announcements, and Event Console filtering/undo.
- SSE realtime with reconnect recovery, safe player payloads, presence heartbeat, GM participant presence, conflict handling, and offline mutation blocking.
- JSON export/import, rotating backups, private avatar storage, health/metrics endpoints, Sentry-compatible error delivery, shared Postgres rate limits, Render deployment, and GitHub Actions.

## Configuration

Copy `.env.example` for local setup. Production requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`, `REQUIRE_PRODUCTION_SERVICES=1`, and `SENTRY_DSN` in the deployment secret manager. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render, migrations, backups, monitoring, and GitHub deployment configuration.

## Daggerforge boundary

`src/content/daggerforge/` is immutable imported base content. Campaign copies and runtime instances are stored separately; the GM Library never mutates the bundled files. The upstream MIT license is preserved at `src/content/daggerforge/LICENSE`. Daggerheart SRD attribution and update/import notes are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
