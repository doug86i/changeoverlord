# Documentation index

Everything below lives in **`docs/`**. The repo root has **[`README.md`](../README.md)** (project overview and **deploy**) and **[`AGENTS.md`](../AGENTS.md)** (rules for AI assistants and architecture-sensitive changes).

---

## Humans

| Document | What it is |
|----------|------------|
| **[`README.md`](../README.md)** | What Changeoverlord does, **Docker quick start**, repo layout, licence |
| **[`USER_GUIDE.md`](USER_GUIDE.md)** | **Operator guide** — events, stages, patch/RF workbook, templates, clocks, settings |
| **[`MAINTAINING_DOCS.md`](MAINTAINING_DOCS.md)** | **How we keep docs updated** — audiences, when to edit what, index rules |
| **[`PLAN.md`](PLAN.md)** | Vision, architecture, roadmap |
| **[`FEATURE_REQUIREMENTS.md`](FEATURE_REQUIREMENTS.md)** | Competitive research, detailed feature requirements for completion |
| **[`DECISIONS.md`](DECISIONS.md)** | Locked product and engineering choices (stack, API, limits) |
| **[`DESIGN.md`](DESIGN.md)** | Visual design — themes, tokens |
| **[`DEVELOPMENT.md`](DEVELOPMENT.md)** | Local testing via **Compose only** (`make dev`), DB resets, optional `npm run build` for CI |
| **[`REALTIME.md`](REALTIME.md)** | Live schedule updates (SSE) vs patch grid collaboration (Yjs + WebSockets) |
| **[`LOGGING.md`](LOGGING.md)** | **Structured logging** — API Pino / `req.log`, web `logDebug`, `LOG_LEVEL`, no secrets |
| **[`LICENSING.md`](LICENSING.md)** | Repository and dependency licences |
| **[`HANDOVER.md`](HANDOVER.md)** | **New machine / teammate** — clone, `make dev`, moving data |
| **[`../CHANGELOG.md`](../CHANGELOG.md)** | **Release notes** — unreleased work and version history |
| **[`../data/README.md`](../data/README.md)** | Host `DATA_DIR` layout (Postgres, uploads) |

---

## AI assistants and core contributors

| Document | What it is |
|----------|------------|
| **[`AGENTS.md`](../AGENTS.md)** | **Start here** — **development process** (Git commits, Compose testing, deploy, changelog, logging), realtime split (SSE vs Yjs), API/query obligations |
| **[`.cursor/rules/`](../.cursor/rules/)** | Cursor project rules (e.g. deploy after changes, realtime architecture) |

---

## Quick orientation

- **Using the app (crew):** [`USER_GUIDE.md`](USER_GUIDE.md).
- **Deploy the stack:** root [`README.md`](../README.md) → **Quick start (Docker)**. **Another computer:** [`HANDOVER.md`](HANDOVER.md).
- **Why we built it this way:** [`DECISIONS.md`](DECISIONS.md) + [`PLAN.md`](PLAN.md).
- **What's left to build:** [`FEATURE_REQUIREMENTS.md`](FEATURE_REQUIREMENTS.md) (user journeys, competitive research, prioritised requirements).
- **Changing REST handlers or TanStack queries:** [`REALTIME.md`](REALTIME.md) + [`AGENTS.md`](../AGENTS.md).
- **Logging conventions:** [`LOGGING.md`](LOGGING.md).
