# Build web (Vite) + API (TypeScript), run Fastify with static SPA + REST.
FROM node:22-alpine AS builder
WORKDIR /build

COPY package.json package-lock.json* ./
COPY api/package.json api/
COPY web/package.json web/

RUN npm install

COPY api api
COPY web web

RUN npm run build -w web && npm run build -w api

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV WEB_PUBLIC_DIR=/app/public

COPY --from=builder /build/web/dist ./public
COPY --from=builder /build/api/dist ./api/dist
COPY --from=builder /build/api/drizzle ./api/drizzle

COPY package.json package-lock.json* ./
COPY api/package.json api/
COPY web/package.json web/

RUN npm install --omit=dev --workspace=@changeoverlord/api

EXPOSE 80

WORKDIR /app/api
CMD ["node", "dist/index.js"]
