FROM node:22-slim

# better-sqlite3 needs build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Create data dir for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
