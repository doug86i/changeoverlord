# Maintaining documentation

This project splits docs by **audience** so nothing important lives only in chat or in code comments.

---

## What lives where

| Audience | Canonical place | Purpose |
|----------|-----------------|--------|
| **Operators / crew** | **[`USER_GUIDE.md`](USER_GUIDE.md)** | How to use the app (flows, settings, clocks, templates). Plain language; no Docker internals. |
| **Deploy / install** | Root **[`README.md`](../README.md)**, **[`HANDOVER.md`](HANDOVER.md)** | Quick start, Compose, ports, data directory; **new machine / teammate** checklist. |
| **Developers** | **[`DEVELOPMENT.md`](DEVELOPMENT.md)**, **[`REALTIME.md`](REALTIME.md)**, **[`DECISIONS.md`](DECISIONS.md)**, **[`LOGGING.md`](LOGGING.md)** | Implementation, sync model, decisions, logging. |
| **Product / roadmap** | **[`PLAN.md`](PLAN.md)**, **[`FEATURE_REQUIREMENTS.md`](FEATURE_REQUIREMENTS.md)** | Vision, architecture, roadmap, and prioritised feature requirements with user-journey analysis. |
| **AI & architecture guardrails** | **[`AGENTS.md`](../AGENTS.md)**, **[`.cursor/rules/`](../.cursor/rules/)** | Query keys, realtime split, deploy-after-change habits. |
| **Release notes** | **[`CHANGELOG.md`](../CHANGELOG.md)** | What changed between versions — **`[Unreleased]`** during development. |

---

## When to update what

| Change | Update |
|--------|--------|
| Notable **fix**, **feature**, or **engineering change** that **ships** (code, Docker image, migrations, dependency changes affecting the build) | **[`CHANGELOG.md`](../CHANGELOG.md)** — **`[Unreleased]`** (see **[`.cursor/rules/changelog.mdc`](../.cursor/rules/changelog.mdc)** for skip cases). |
| New or renamed **user-visible** feature, route, or label | **[`USER_GUIDE.md`](USER_GUIDE.md)** (and screenshot copy in-app if applicable). |
| New **operator-facing** setting or default | **`USER_GUIDE.md`** + one line in **`PLAN.md`** / **`DECISIONS.md`** only if it’s a product decision. |
| **REST** / **SSE** / **TanStack** keys / Yjs behaviour | **`REALTIME.md`**, **`AGENTS.md`**, and code — not **`USER_GUIDE.md`** unless users need to *know* (e.g. “changes appear live”). |
| **Docker**, **env**, **ports**, **migrations** | **`README.md`**, **`DEVELOPMENT.md`**, **`data/README.md`**, **`HANDOVER.md`** (if clone/data-move steps change) as appropriate. |
| **Agent workflow** (Git commit granularity, Compose testing, deploy steps, changelog, logging expectations, Dockerfile speed tricks) | **`AGENTS.md`**, **`CHANGELOG.md`**, **`DEVELOPMENT.md`** § *Git commits*, **`git-commits.mdc`**, **`local-docker-deploy.mdc`**, **`changelog.mdc`**, **`logging.mdc`**. |
| **Yjs / `@y/protocols` / `yjs` version pins** | **`package.json`** (root **`overrides`**), **`api/package.json`**, **`DECISIONS.md`** (*Yjs / WebSocket npm compatibility*). Regenerate **`package-lock.json`** after changing pins (`rm -rf node_modules package-lock.json && npm install` if npm reports **invalid** hoisting). |
| **Feature completed or priorities shift** | **`FEATURE_REQUIREMENTS.md`** (update tier/status), **`PLAN.md`** §14 (roadmap checklist). |
| **Stack or licence** change | **`DECISIONS.md`**, **`LICENSING.md`**. |
| **Built-in patch template presets** (blank/example layouts, bundled seed template) | **`api/src/lib/patch-template-presets.ts`**, **`api/src/lib/seed-patch-templates.ts`**, **`USER_GUIDE.md`** (templates section), and **`POST /patch-templates/new`** in **`api/src/routes/v1/patch-templates.ts`**. |
| **File attachments** (riders/plots: upload, list, extract PDF page, delete) | **`api/src/routes/v1/files.ts`**, **`api/src/lib/pdf.ts`**, **`api/src/lib/upload-allowlists.ts`**, **`web/src/components/FileAttachments.tsx`**, **`USER_GUIDE.md`** (Files section), **`docs/REALTIME.md`** (`broadcastInvalidate` keys `files` / `files`+`performance`), **`docs/LICENSING.md`** (**pdf-lib**). |

---

## Index and discoverability

Whenever you add or substantially rename a **top-level doc** under **`docs/`**:

1. Add a row to **[`docs/README.md`](README.md)** (Humans table unless it’s agent-only).
2. If operators care, add a short pointer in root **[`README.md`](../README.md)** under **Documentation** (or “What’s in the box” if that’s the only index).

Keep **`docs/README.md`** the single **table of contents** for `docs/`.

---

## Style (user guide)

- **Second person** (“you”) or neutral **imperatives** (“Open Settings”).
- Prefer **stable concepts** (event → stage → day → performance) over transient button text.
- **Don’t duplicate** install steps from **`README.md`** — link instead.
- If the UI is likely to churn, describe **intent** (“assign a default template for this stage”) and keep proper nouns (**Settings**, **Events**) aligned with the app header.

---

## Review cadence (lightweight)

- **With each release** (or merge to `main` that changes UX): skim **`USER_GUIDE.md`** against the app.
- **PLAN roadmap** items marked shipped: add or adjust **`USER_GUIDE.md`** sections in the same change set when possible.

---

## Cursor / AI

Project rules **`user-documentation`**, **`changelog`**, and **`git-commits`** remind agents to update **`USER_GUIDE.md`** / **`CHANGELOG.md`** when appropriate, and to **`git commit`** in small logical steps with clear messages. See **[`.cursor/rules/user-documentation.mdc`](../.cursor/rules/user-documentation.mdc)**, **[`.cursor/rules/changelog.mdc`](../.cursor/rules/changelog.mdc)**, and **[`.cursor/rules/git-commits.mdc`](../.cursor/rules/git-commits.mdc)**.
