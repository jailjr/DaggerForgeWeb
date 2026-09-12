# Production deployment

Build and run the image with a secret manager or GitHub Actions environment. Do not commit `.env` files or provider keys.

Required runtime secrets:

- `DATABASE_URL` — hosted Postgres connection string with SSL.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — private avatar and backup storage.
- `CORS_ORIGIN` — exact HTTPS frontend origin.
- `REQUIRE_PRODUCTION_SERVICES=1` — fail-fast production validation.

Recommended operational settings:

- `ENABLE_BACKUPS=1`, `BACKUP_INTERVAL_MS`, `BACKUP_RETENTION`.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_WINDOW_MS`.
- `TRUST_PROXY=1` only when deployed behind a trusted reverse proxy.
- `LOG_AGGREGATION_WEBHOOK` for structured security/error delivery.
- `MONITOR_BASE_URL` and `MONITOR_ALERT_WEBHOOK` as GitHub repository or environment secrets.

The CI workflow runs tests, the production build, and a Docker build. The container healthcheck calls `/health`; external monitoring also validates `/metrics`. Configure Postgres point-in-time recovery, storage bucket versioning/retention, and deployment rollback policy at the provider level.
