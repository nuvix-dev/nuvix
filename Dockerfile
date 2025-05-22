# -------- Stage 1: Build native node modules using Node.js --------
FROM node:20 AS node-modules
WORKDIR /app

COPY package.json ./

# Install native modules (like libpg-query, etc.)
RUN npm install

# -------- Stage 2: Bun + Final Build --------
FROM oven/bun:latest AS base
WORKDIR /app

RUN ln -s /usr/local/bin/bun /usr/local/bin/node
COPY --from=node-modules /app/node_modules ./node_modules

COPY bun.lockb ./
COPY . .

# Install remaining packages using Bun
RUN bun install --frozen-lockfile

# -------- Stage 3: Development Stage --------
FROM base AS development
WORKDIR /app
EXPOSE 4000
EXPOSE 4100

# -------- Stage 4: Production Stage --------
FROM base AS production
WORKDIR /app

RUN bun --bun run build nuvix console