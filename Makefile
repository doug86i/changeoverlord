.PHONY: dev dev-app dev-fresh deploy-local up dev-down

# Compose files: base (GHCR image) + dev overlay (`build: .`). See docker-compose.yml header.
COMPOSE = docker compose -f docker-compose.yml -f docker-compose.dev.yml

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
