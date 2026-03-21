.PHONY: dev deploy-local up dev-down

# Local test stack: rebuild app image + start Postgres/Redis/app (see docs/DEVELOPMENT.md).
# This is the default deploy path — use after code changes so Compose stays validated.

dev: up

deploy-local: up

up:
	docker compose up -d --build

dev-down:
	docker compose down
