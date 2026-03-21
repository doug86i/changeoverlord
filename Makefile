.PHONY: dev dev-watch dev-down

# Thin wrappers around the single docker-compose.yml (see file header for env vars).

dev:
	docker compose up -d --build

dev-watch:
	docker compose watch

dev-down:
	docker compose down
