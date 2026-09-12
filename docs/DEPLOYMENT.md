# Production deployment

Build and run the image with a secret manager or GitHub Actions environment. Do not commit `.env` files or provider keys.

Required runtime secrets:

- `DATABASE_URL` — hosted Postgres connection string with SSL.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — private avatar and backup storage.
- `CORS_ORIGIN` — exact HTTPS frontend origin.
- `REQUIRE_PRODUCTION_SERVICES=1` — fail-fast production validation.
- `SENTRY_DSN` — durable error/security event aggregation. The webhook is retained only as an optional compatibility sink.

Recommended operational settings:

- `ENABLE_BACKUPS=1`, `BACKUP_INTERVAL_MS`, `BACKUP_RETENTION`.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_WINDOW_MS`.
- With `DATABASE_URL`, rate-limit buckets are stored in Postgres and shared by all instances; the in-memory limiter is only a development fallback.
- `TRUST_PROXY=1` only when deployed behind a trusted reverse proxy.
- `SENTRY_DSN` for durable error/security delivery; `LOG_AGGREGATION_WEBHOOK` is optional.
- `MONITOR_BASE_URL` and `MONITOR_ALERT_WEBHOOK` as GitHub repository or environment secrets.

The repository includes a Render Blueprint in `render.yaml`. Connect the repository in Render, create the Blueprint, and provide the `sync: false` secrets in the Render dashboard. GitHub Actions verifies every push and pull request. The dedicated `Deploy production` workflow publishes `ghcr.io/<owner>/<repo>:<sha>` and `:latest`, then requests a Render release.

In GitHub, create a protected `production` environment and add `RENDER_DEPLOY_HOOK_URL` as an environment secret. Add approval protection to that environment if releases need human approval. The workflow intentionally fails before release when this secret is absent, rather than reporting a successful non-deployment. Put `MONITOR_BASE_URL` and `MONITOR_ALERT_WEBHOOK` in the same environment so the scheduled health monitor uses the protected production configuration.

The container healthcheck calls `/health`; external monitoring also validates `/metrics`. Configure Postgres point-in-time recovery, storage bucket versioning/retention, and deployment rollback policy at the provider level.
