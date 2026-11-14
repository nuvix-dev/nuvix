# syntax=docker/dockerfile:1.4
# Nuvix v2 — Bun-native runtime Dockerfile with AOT route compilation.
# Supports APP_NAME=server (default) or APP_NAME=platform.
#
# The build stage dry-runs the app and compiles every route handler ahead of
# time (see build.ts and https://next.elysiajs.com/patterns/aot/); the runtime
# image executes the compiled bundle — faster startup and lower peak memory.

FROM oven/bun:1.4.0 AS base
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests, lockfile, sources, assets, and the build script
COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/ apps/
COPY build.ts build.ts
COPY assets/ assets/

# Full install (the AOT dry-run imports the app graph), then compile the
# selected app into apps/${APP_NAME}/dist
ARG APP_NAME=server
RUN bun install --frozen-lockfile && APP_NAME=${APP_NAME} bun run build.ts

# -------------------------------------------------------------
# Runtime image — production dependencies + compiled bundle + assets
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

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Compiled AOT bundle (sits beside src/ so assets.ts depth-resolution holds)
COPY --from=base /app/apps/${APP_NAME}/dist /app/apps/${APP_NAME}/dist
# Runtime asset tree (avatars, fonts, i18n, mail templates, OAuth views, GeoIP)
COPY assets/ assets/

EXPOSE 4000 4100

CMD ["sh", "-c", "bun apps/${APP_NAME}/dist/index.js"]
