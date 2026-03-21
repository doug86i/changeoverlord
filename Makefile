.PHONY: dev dev-watch dev-down

# Start stack with live-mounted static files (edit docker/html/ and refresh browser).
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Foreground: also rebuild app when Dockerfile changes (Ctrl+C to stop).
dev-watch:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml watch

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down
