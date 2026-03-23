# Internet beta deployment hardening (HAProxy)

This runbook is for exposing Changeoverlord to internet beta testers when TLS termination is already handled by HAProxy.

## 1) Required app environment

Set these values in `.env` on the app host before starting the stack:

- `NODE_ENV=production` (already set by `docker-compose.yml`)
- `SESSION_SECRET=<long random secret>`
- `CORS_ALLOWED_ORIGINS=https://your-beta-domain.example`
- `FORCE_SECURE_COOKIES=1`
- `REQUIRE_PASSWORD=1`
- `LOG_LEVEL=info`
- `HOST_BIND=127.0.0.1` (recommended when HAProxy runs on the same host)
- `HOST_PORT=8080` (or another private backend port)

Notes:

- `REQUIRE_PASSWORD=1` makes API startup fail if no shared password is configured in Settings.
- Keep client debug logging disabled in public beta (`CLIENT_LOG_FILE` unset, `VITE_CLIENT_LOG_FILE=false`).

## 2) HAProxy requirements

Your HAProxy frontend/backend should enforce all of the following:

- HTTPS redirect from port 80 to 443.
- HSTS header on TLS responses.
- Forwarded proto header:
  - `X-Forwarded-Proto: https`
- WebSocket upgrade support for `/ws/v1/*`.
- Long-lived streaming support for SSE (`/api/v1/realtime`) without buffering.
- Basic request controls:
  - per-IP connection/request limits
  - request body size limit
  - sane timeouts

Minimal backend behavior target:

- Public traffic hits only HAProxy on `:443`.
- Changeoverlord app listens on localhost/private interface only.
- Postgres remains unexposed (no published DB port).

## 3) Shared password policy for beta

Before go-live:

1. Open Settings in the app.
2. Set a strong shared password.
3. Confirm login is required from a fresh browser session.

Because `REQUIRE_PASSWORD=1` is enabled, future restarts will fail fast if password protection is removed.

## 4) Backup and restore operations

Use the included scripts from repo root:

- Create backup: `./scripts/backup-data.sh`
- Restore backup: `./scripts/restore-data.sh ./backups/<timestamp>`

Backups include:

- PostgreSQL logical dump (`db.sql`)
- Uploaded files archive (`uploads.tgz`)

Run one restore rehearsal on a non-production host before inviting testers.

## 5) Prelaunch verification checklist

Run:

- `./scripts/preflight-beta.sh https://your-beta-domain.example`

Then manually verify:

- login/logout from a fresh private browser window
- two-browser patch collaboration (cell edits + add/delete sheet)
- file upload/download
- stage clock and SSE live refresh

## 6) Rollout and monitoring

Suggested rollout:

1. Invite 2-3 internal testers.
2. Watch logs and disk usage for 24 hours.
3. Expand to external beta cohort.

Monitor:

- auth failures
- 4xx/5xx spikes
- WebSocket disconnect churn
- disk growth under `DATA_DIR`

Rollback:

1. Deploy previous image tag (`APP_IMAGE_TAG=<previous>`).
2. `docker compose pull && docker compose up -d`
3. If needed, restore latest known-good backup.
