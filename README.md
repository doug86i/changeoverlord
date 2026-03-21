# Festival stage operations

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Designed for **LAN / offline** deployment with optional cloud hosting.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

## Quick start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2.

```bash
git clone https://github.com/doug86i/festival-stage-ops.git
cd festival-stage-ops
docker compose pull   # first run: pulls images from GHCR
docker compose up -d
```

Open **http://\<server-ip\>** (port **80** by default — no port in the URL).

- **Alternate host port** (e.g. 8080): see `compose.override.example.yml`.
- **Offline after first pull**: images stay in Docker’s cache; no internet needed on show site.

## Repository layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Stack: Postgres, Redis, app |
| `Dockerfile` | App image (placeholder until UI/API land) |
| `.github/workflows/` | Build and push `app` image to **GHCR** |

## Status

**Early scaffold** — application features are tracked in project issues and the internal product plan. PRs welcome.

## License

MIT — see [LICENSE](LICENSE).
