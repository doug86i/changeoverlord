# syntax=docker/dockerfile:1
# Build web (Vite) + API (TypeScript), run Fastify with static SPA + REST.
#
# Speed (BuildKit):
# - `npm install` uses a cache mount for ~/.npm when lockfiles are stable.
# - API and WEB are built in separate RUN steps so a change in only one workspace
#   reuses the cached layer for the other (big win vs one combined RUN).
# - `npm run build -w api` uses a cache mount for tsc incremental metadata.
# - `npm run build -w web` uses a cache mount for Vite's `node_modules/.vite` cache.
FROM node:22-alpine AS builder
WORKDIR /build

COPY package.json package-lock.json* ./
COPY api/package.json api/
COPY web/package.json web/
COPY patches patches

RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY api api
# Wipe `api/dist` and incremental metadata before `tsc`. If we only remove `dist`
# but keep `api/.cache/tsconfig.tsbuildinfo` (on the cache mount), tsc can emit
# nothing while exiting 0 — producing an empty `api/dist` and a broken image.
RUN --mount=type=cache,target=/build/api/.cache \
    rm -rf api/dist && \
    rm -f api/.cache/tsconfig.tsbuildinfo && \
    npm run build -w api

COPY web web
RUN --mount=type=cache,target=/build/node_modules/.vite \
    npm run build -w web

FROM node:22-alpine AS runner
WORKDIR /app

# Runtime CLI tools — split from LibreOffice so smaller layers cache independently.
# BuildKit cache mount: reuses Alpine package downloads across builds when this step re-runs.
# Poppler `pdftoppm` — PDF page thumbnails; ImageMagick — images → PDF.
# `libwebp-tools` supplies `dwebp`/`cwebp` so ImageMagick can read/write WebP (common phone uploads).
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache poppler-utils imagemagick libwebp-tools

# LibreOffice + fonts — large dependency tree (most of the image size). Separate layer + cache mount
# keeps `make dev` faster when only app code changes above this line.
# `ttf-dejavu` gives LibreOffice usable fonts when embedding PDFs (otherwise many glyphs can be missing).
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache libreoffice ttf-dejavu

ENV NODE_ENV=production
ENV PORT=80
ENV WEB_PUBLIC_DIR=/app/public

COPY --from=builder /build/web/dist ./public
COPY --from=builder /build/api/dist ./api/dist
COPY --from=builder /build/api/drizzle ./api/drizzle

COPY package.json package-lock.json* ./
COPY api/package.json api/
COPY web/package.json web/

RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --ignore-scripts --workspace=@changeoverlord/api && \
    chown -R node:node /app

USER node

EXPOSE 80

WORKDIR /app/api
CMD ["node", "dist/index.js"]
