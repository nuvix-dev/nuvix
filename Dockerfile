# -------------------------------
# STAGE 1: BASE DEPS
# -------------------------------
FROM oven/bun:1.3.5 AS deps

WORKDIR /app

# Copy only dependency manifests required for monorepo resolution
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/platform/package.json apps/platform/package.json
COPY libs/core/package.json libs/core/package.json
COPY libs/pg-meta/package.json libs/pg-meta/package.json
COPY libs/utils/package.json libs/utils/package.json

RUN bun install --frozen-lockfile

# -------------------------------
# STAGE 2: BUILD
# -------------------------------
FROM deps AS build

ARG APP_NAME
ENV APP_NAME=$APP_NAME

WORKDIR /app

# Copy source only after deps are cached
COPY . .

RUN bun turbo build --filter=@nuvix/${APP_NAME} --force

# -------------------------------
# STAGE 3: PROD DEPS
# -------------------------------
FROM oven/bun:1.3.5 AS prod-deps

ARG APP_NAME
ENV APP_NAME=$APP_NAME

WORKDIR /prod/${APP_NAME}

# Copy ONLY generated dependency manifests
COPY --from=build /app/dist/${APP_NAME}/package.json ./

# This layer is now perfectly cacheable
RUN bun install --production 

# -------------------------------
# STAGE 4: RUNTIME
# -------------------------------
FROM oven/bun:1.3.5-slim AS runtime

ARG APP_NAME
ENV APP_NAME=$APP_NAME
ENV NODE_ENV=production

WORKDIR /app

# Copy runtime code
COPY --from=build /app/dist/${APP_NAME} ./

# Attach resolved production node_modules
COPY --from=prod-deps /prod/${APP_NAME}/node_modules ./node_modules

CMD ["bun", "run", "start"]
