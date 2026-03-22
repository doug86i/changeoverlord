.PHONY: dev dev-app dev-fresh dev-rebuild dev-fast dev-fast-app dev-fast-rebuild dev-fast-down deploy-local up dev-down

# Compose files: base (GHCR image) + dev overlay (`build: .`). See docker-compose.yml header.
COMPOSE = docker compose -f docker-compose.yml -f docker-compose.dev.yml

# Fast iteration: Postgres + tsx watch + Vite (bind mounts). See docker-compose.fast.yml.
COMPOSE_FAST = docker compose -f docker-compose.fast.yml

GATE = ./scripts/docker-build-gate.sh

# Local test = Postgres + app from this repo (see docs/DEVELOPMENT.md).
# `up` / `dev-fast` skip `docker compose --build` when image inputs are unchanged (see scripts/docker-build-gate.sh).
# Force rebuild: FORCE_DOCKER_REBUILD=1 make dev
# If the browser still shows old behaviour on the classic stack, use `make dev-fresh`.

dev: up

# Rebuild only the app image when inputs changed, then restart app (Postgres unchanged).
dev-app:
	@if [ "$(FORCE_DOCKER_REBUILD)" = "1" ]; then \
	  $(COMPOSE) build app && $(COMPOSE) up -d app && $(GATE) classic stamp; \
	elif $(GATE) classic needs; then \
	  $(COMPOSE) build app && $(COMPOSE) up -d app && $(GATE) classic stamp; \
	else \
	  $(COMPOSE) up -d app; \
	fi

# Rebuild app with no Docker layer cache, then restart the app container (DB unchanged).
dev-fresh:
	$(COMPOSE) build --no-cache app && $(COMPOSE) up -d app && $(GATE) classic stamp

# Always rebuild classic app image and start stack (ignores stamp).
dev-rebuild:
	$(COMPOSE) up -d --build && $(GATE) classic stamp

deploy-local: up

up:
	@if [ "$(FORCE_DOCKER_REBUILD)" = "1" ]; then \
	  $(COMPOSE) up -d --build && $(GATE) classic stamp; \
	elif $(GATE) classic needs; then \
	  $(COMPOSE) up -d --build && $(GATE) classic stamp; \
	else \
	  $(COMPOSE) up -d; \
	fi

dev-down:
	$(COMPOSE) down

# Bind-mount dev stack (hot reload). UI: http://localhost/ (FAST_WEB_PORT maps host→5173). API: :3000
dev-fast:
	@if [ "$(FORCE_DOCKER_REBUILD)" = "1" ]; then \
	  $(COMPOSE_FAST) build && $(COMPOSE_FAST) up -d && $(GATE) fast stamp; \
	elif $(GATE) fast needs; then \
	  $(COMPOSE_FAST) build && $(COMPOSE_FAST) up -d && $(GATE) fast stamp; \
	else \
	  $(COMPOSE_FAST) up -d; \
	fi

# Rebuild fast images when needed, then restart api + web only (Postgres unchanged).
dev-fast-app:
	@if [ "$(FORCE_DOCKER_REBUILD)" = "1" ]; then \
	  $(COMPOSE_FAST) build api web && $(COMPOSE_FAST) up -d api web && $(GATE) fast stamp; \
	elif $(GATE) fast needs; then \
	  $(COMPOSE_FAST) build api web && $(COMPOSE_FAST) up -d api web && $(GATE) fast stamp; \
	else \
	  $(COMPOSE_FAST) up -d api web; \
	fi

# Always rebuild fast images (ignores stamp).
dev-fast-rebuild:
	$(COMPOSE_FAST) build && $(COMPOSE_FAST) up -d && $(GATE) fast stamp

dev-fast-down:
	$(COMPOSE_FAST) down
