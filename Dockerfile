# -------------------------------
# STAGE 1: BASE DEPS
# -------------------------------
FROM oven/bun:1.3.7 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE_DIR=/bun/cache

COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/platform/package.json apps/platform/package.json
COPY libs/core/package.json libs/core/package.json
COPY libs/pg-meta/package.json libs/pg-meta/package.json
COPY libs/utils/package.json libs/utils/package.json

RUN --mount=type=cache,id=bun-cache-1.3.7,target=/bun/cache \
    bun install --frozen-lockfile

# -------------------------------
# STAGE 2: BUILD
# -------------------------------
FROM deps AS build
ARG APP_NAME
WORKDIR /app
COPY . .
RUN bun turbo build --filter=@nuvix/${APP_NAME} --force

# -------------------------------
# STAGE 3: PROD DEPS
# -------------------------------
FROM oven/bun:1.3.7 AS prod-deps
ARG APP_NAME
WORKDIR /prod/${APP_NAME}

COPY --from=build /app/dist/${APP_NAME}/package.json ./
RUN --mount=type=cache,id=bun-cache-1.3.7,target=/bun/cache \
    bun install --production

# -------------------------------
# STAGE 4: RUNTIME
# -------------------------------
FROM oven/bun:1.3.7-slim AS runtime

ARG APP_NAME
ARG VERSION=dev
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown

ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Nuvix ${APP_NAME}" \
      org.opencontainers.image.description="Nuvix backend platform component" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://github.com/nuvix/nuvix" \
      org.opencontainers.image.licenses="FSL-1.1-Apache-2.0" \
      org.opencontainers.image.authors="Nuvix <support@nuvix.in>" \
      org.opencontainers.image.url="https://nuvix.in" \
      org.opencontainers.image.vendor="Nuvix"

WORKDIR /app

COPY --from=build /app/dist/${APP_NAME} ./
COPY --from=prod-deps /prod/${APP_NAME}/node_modules ./node_modules

CMD ["bun", "run", "start"]
