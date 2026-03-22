# Documentation index

Everything below lives in **`docs/`**. The repo root has **[`README.md`](../README.md)** (project overview, install, features) and **[`AGENTS.md`](../AGENTS.md)** (rules for AI assistants and architecture-sensitive changes).

---

## For operators and crew

| Document | What it covers |
|----------|----------------|
| **[`USER_GUIDE.md`](USER_GUIDE.md)** | How to use the app — events, stages, patch/RF workbook, templates, clocks, files, chat, settings |

## For developers and contributors

| Document | What it covers |
|----------|----------------|
| **[`DEVELOPMENT.md`](DEVELOPMENT.md)** | Local testing (`make dev-fast` / `make dev`), Docker rebuilds, patches, new machine setup, doc maintenance |
| **[`DECISIONS.md`](DECISIONS.md)** | Locked product and engineering choices (stack, API, limits, auth, visual design tokens) |
| **[`REALTIME.md`](REALTIME.md)** | Live schedule updates (SSE) vs patch grid collaboration (WebSocket JSON op relay) |
| **[`LOGGING.md`](LOGGING.md)** | Structured logging — API Pino / `req.log`, web `logDebug`, optional fast-stack **client NDJSON** (`$DATA_DIR/logs/client-debug.ndjson`), `LOG_LEVEL`, no secrets |
| **[`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)** | Known issues and technical debt — code, infra, CSS, realtime, collab (**#83** duplicate tabs), follow-ups |
| **[`PATCH_TEMPLATE_JSON.md`](PATCH_TEMPLATE_JSON.md)** | FortuneSheet JSON patch template upload — file shape, preserved fields, API |
| **[`LICENSING.md`](LICENSING.md)** | Repository and dependency licences |

## Product and roadmap

| Document | What it covers |
|----------|----------------|
| **[`ROADMAP.md`](ROADMAP.md)** | Vision, user personas, shipped features, what's next, competitive landscape |

## Other

| Document | What it covers |
|----------|----------------|
| **[`../CHANGELOG.md`](../CHANGELOG.md)** | Release notes — unreleased work and version history |
| **[`../data/README.md`](../data/README.md)** | Host `DATA_DIR` layout (Postgres, uploads) |
| **[`../AGENTS.md`](../AGENTS.md)** | AI assistants — development process, realtime split, code-change obligations |

---

## Quick orientation

- **Using the app (crew):** [`USER_GUIDE.md`](USER_GUIDE.md).
- **Install / deploy:** root [`README.md`](../README.md).
- **Build from source / contribute:** [`DEVELOPMENT.md`](DEVELOPMENT.md).
- **Why we built it this way:** [`DECISIONS.md`](DECISIONS.md).
- **What's left to build:** [`ROADMAP.md`](ROADMAP.md).
- **Changing REST handlers or TanStack queries:** [`REALTIME.md`](REALTIME.md) + [`AGENTS.md`](../AGENTS.md).
- **Known engineering backlog:** [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).
