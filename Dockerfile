# syntax=docker/dockerfile:1.4
# Nuvix v2 — Bun-native runtime Dockerfile
# Supports APP_NAME=server (default) or APP_NAME=platform

FROM oven/bun:1.4.0 AS base
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests and lockfile
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/ apps/
COPY assets/ assets/

# Install dependencies (respecting frozen lockfile)
RUN bun install --frozen-lockfile --production

# -------------------------------------------------------------
# Runtime image
# -------------------------------------------------------------
FROM oven/bun:1.4.0-slim AS runtime
WORKDIR /app

ARG APP_NAME=server
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Nuvix v2 ${APP_NAME}" \
      org.opencontainers.image.description="Bun-native Nuvix v2 platform component" \
      org.opencontainers.image.source="https://github.com/nuvix-dev/nuvix" \
      org.opencontainers.image.licenses="FSL-1.1-Apache-2.0" \
      org.opencontainers.image.vendor="Nuvix"

COPY --from=base /app /app

EXPOSE 4000 4100

CMD ["sh", "-c", "bun run apps/${APP_NAME}/src/index.ts"]
