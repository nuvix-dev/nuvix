# --- STAGE 1: BUILDER ---
    FROM oven/bun:1.3.0 AS builder

    ARG APP_NAME
    ENV APP_NAME=$APP_NAME
    
    WORKDIR /app
    COPY package.json bun.lock ./
    COPY apps/server/package.json ./apps/server/package.json
    COPY apps/platform/package.json ./apps/platform/package.json
    COPY libs/core/package.json ./libs/core/package.json
    COPY libs/pg-meta/package.json ./libs/pg-meta/package.json
    COPY libs/utils/package.json ./libs/utils/package.json
    
    RUN bun install --frozen-lockfile
    
    COPY . .
    RUN bun turbo build --filter=@nuvix/$APP_NAME --force
    
    # --- STAGE 2: RUNTIME ---
    # This is the final image, which is as small as possible.
    FROM oven/bun:1.3.0-slim AS runtime
    
    # Set environment variables for the runtime image.
    ARG APP_NAME
    ENV APP_NAME=$APP_NAME
    ENV NODE_ENV=production
    
    WORKDIR /app
    
    # Copy the final build artifacts and necessary runtime files from the 'builder' stage.
    COPY --from=builder /app/dist/pkg/${APP_NAME} ./
    COPY --from=builder /app/dist/${APP_NAME} ./
    COPY --from=builder /app/assets ./assets
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/docs/references ./docs/references
    COPY --from=builder /app/.env* ./
    
    RUN bun i
    
    CMD ["bun", "main.js"]
