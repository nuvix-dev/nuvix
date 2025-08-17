# -------- Stage 1: Base Build (Node.js + Bun Installation + Package Install) --------
# This combined stage uses Node.js as the base, installs native Node modules,
# then installs Bun, and finally installs all project dependencies.
FROM node:20 AS base
WORKDIR /app

# Install necessary tools for Bun installation (curl, unzip),
# and also Python and build-essential for node-gyp to compile native modules.
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    python3 \
    build-essential \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Bun via the official script.
# The script typically installs Bun to ~/.bun/bin.
RUN curl -fsSL https://bun.sh/install | bash

# Add Bun's bin directory to the PATH environment variable so `bun` commands are found.
ENV PATH="/root/.bun/bin:$PATH"

RUN npm install pgsql-parser --no-save
# Copy the Bun lock file and all project files into the image.
COPY bun.lock ./
COPY . .

# The --frozen-lockfile flag ensures that the bun.lock file is respected and not modified.
RUN bun install

# -------- Stage 2: Development Stage --------
# This stage is optimized for development, building upon the 'base' stage.
FROM base AS development
WORKDIR /app
EXPOSE 4000
EXPOSE 4100

# -------- Stage 3: Production Stage --------
# This stage is for building the final production artifact, also from 'base'.
FROM base AS production
WORKDIR /app

# Run the production build command using Bun.
RUN bun turbo build --filter=@nuvix/api --filter=@nuvix/platform
