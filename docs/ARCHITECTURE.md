# DaggerForge Web architecture

## Runtime shape

The client is a Vite + React + TypeScript single-page application. `server/index.js` serves the production bundle and campaign API from the same HTTPS origin. Local Vite development uses the API on port 8787. `src/content/daggerforge/` contains immutable imported Daggerheart base data; campaign custom content and runtime instances are stored independently.

## Persistence

With `DATABASE_URL`, the API hydrates and persists normalized campaign, participant, character, session, encounter, library, audit, auth-session, and rate-limit records through `server/postgres-store.js` and versioned SQL migrations. A local JSON store remains a development fallback only. Mutations are campaign-scoped and character writes use row versions for optimistic concurrency.

Private notes, GM library content, unused adversaries/environments/items, and other hidden fields are removed in the server projection. Player realtime and history payloads use `safeEventForPlayer`; they never rely on the frontend to hide private values. GM presence includes nickname and assignment context, while players receive only a count.

## Domain model

The server character model validates Daggerheart classes, ancestries, communities, traits, experiences, domain cards, equipment, resource ranges, and inventory. Supported derived values are recalculated from authoritative configuration when their source changes. The client locks configuration in PLAY but the server remains authoritative. Temporary effects remain descriptive notes, as required by the product specification; no separate active-effects subsystem is introduced.

Adversaries are copied into independent encounter runtime instances. Their source definition is never mutated. Table View exposes the source-defined Action and Reaction features as auditable GM actions, tracks HP/Fear, and shows environment details. It deliberately does not implement initiative, turns, rounds, or invented conditions.

## Realtime and recovery

Campaign SSE streams carry authorized audit events. The client heartbeats presence every 20 seconds, reconnects with exponential backoff, reauthenticates through the HttpOnly session cookie, resubscribes, and pages through recent history to recover missed events. Small character and encounter updates are applied to the affected entity; unrelated campaign state is not refetched. Conflicts return HTTP 409 and are presented with reload/retry actions.

## Audit, backup, and operations

Meaningful gameplay mutations append audit events containing actor identity snapshot, operation, entity, field, before/after values, and timestamps. Undo is a new concurrency-checked mutation. Export excludes credentials; import always creates a new campaign and remaps participant/character identities. Automatic/manual backups use external object storage when configured, with local files only as a development fallback. `/health` and `/metrics` support external uptime monitoring; Sentry receives server errors/security events when configured.

## Deployment and limitations

Render runs the Docker image with Node 20, hosted Postgres, Supabase private object storage, HTTPS, and GitHub Actions. `REQUIRE_PRODUCTION_SERVICES=1` fails fast if required hosted services are absent. Configure provider point-in-time recovery, bucket retention, Render rollback policy, the Render deploy hook, and monitoring secrets as described in [DEPLOYMENT.md](DEPLOYMENT.md). Free-tier limits, sleeping behavior, backup retention, and provider terms remain provider-specific and must not be represented as an unlimited guarantee.

## Testing and maintenance

Vitest covers domain and API behavior. Playwright covers campaign creation, character creation, Help/mobile navigation, and runs in CI against desktop and mobile Chromium. Add new behavior at the server boundary first, update the corresponding browser flow, and keep migrations and this document synchronized with production behavior.

## Attribution and update boundary

The upstream MIT notice is preserved at `src/content/daggerforge/LICENSE`. Base content is refreshed by replacing/importing that directory, never by mutating campaign records. Custom content references its origin and remains in campaign storage so upstream updates do not overwrite GM work.
