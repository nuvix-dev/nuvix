# -------------------------------
# STAGE 1: BUILDER
# -------------------------------
FROM oven/bun:1.3.5 AS builder

ARG APP_NAME
ENV APP_NAME=$APP_NAME

WORKDIR /app

# 1. Install monorepo toolchain dependencies
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/platform/package.json ./apps/platform/package.json
COPY libs/core/package.json ./libs/core/package.json
COPY libs/pg-meta/package.json ./libs/pg-meta/package.json
COPY libs/utils/package.json ./libs/utils/package.json

RUN bun install --frozen-lockfile

# 2. Copy full source and build the app
COPY . .
RUN bun turbo build --filter=@nuvix/${APP_NAME} --force

# 3. Resolve *production* dependency graph ONCE
#    This generates the production bun.lockb
WORKDIR /app/dist/${APP_NAME}
RUN bun install --production

# -------------------------------
# STAGE 2: RUNTIME
# -------------------------------
FROM oven/bun:1.3.5-slim AS runtime

ARG APP_NAME
ENV APP_NAME=$APP_NAME
ENV NODE_ENV=production

WORKDIR /app

# 4. Copy the fully prepared production artifact
COPY --from=builder /app/dist/${APP_NAME} ./

# 5. Replay the resolved graph deterministically
RUN bun install --production --frozen-lockfile

# 6. Run the bundled server
CMD ["bun", "run", "start"]
