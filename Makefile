.PHONY: dev dev-fresh deploy-local up dev-down

# Local test = production path: rebuild app image + Postgres + app (see docs/DEVELOPMENT.md).
# Run after code changes: `make dev` (same as `docker compose up -d --build`).
# If the browser still shows old behaviour, the image layers may be cached — use `make dev-fresh`.

dev: up

# Rebuild app with no Docker layer cache, then restart the app container (DB unchanged).
dev-fresh:
	docker compose build --no-cache app && docker compose up -d app

deploy-local: up

up:
	docker compose up -d --build

dev-down:
	docker compose down
