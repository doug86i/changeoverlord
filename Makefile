.PHONY: dev dev-app dev-fresh dev-fast dev-fast-app dev-fast-down deploy-local up dev-down

# Compose files: base (GHCR image) + dev overlay (`build: .`). See docker-compose.yml header.
COMPOSE = docker compose -f docker-compose.yml -f docker-compose.dev.yml

# Fast iteration: Postgres + tsx watch + Vite (bind mounts). See docker-compose.fast.yml.
COMPOSE_FAST = docker compose -f docker-compose.fast.yml

# Local test = rebuild app image from this repo + Postgres + app (see docs/DEVELOPMENT.md).
# Deploy without building: `docker compose pull && docker compose up -d` (base file only).
# If the browser still shows old behaviour, the image layers may be cached — use `make dev-fresh`.

dev: up

# Rebuild only the app image and restart the app container (Postgres unchanged). Same as:
#   $(COMPOSE) build app && $(COMPOSE) up -d app
dev-app:
	$(COMPOSE) build app && $(COMPOSE) up -d app

# Rebuild app with no Docker layer cache, then restart the app container (DB unchanged).
dev-fresh:
	$(COMPOSE) build --no-cache app && $(COMPOSE) up -d app

deploy-local: up

up:
	$(COMPOSE) up -d --build

dev-down:
	$(COMPOSE) down

# Bind-mount dev stack (hot reload). UI: http://localhost:5173/ (or FAST_WEB_PORT). API: http://localhost:3000/api/v1/health
dev-fast:
	$(COMPOSE_FAST) up -d --build

# Rebuild/restart api + web only (Postgres unchanged).
dev-fast-app:
	$(COMPOSE_FAST) up -d --build api web

dev-fast-down:
	$(COMPOSE_FAST) down
