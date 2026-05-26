FROM node:22-slim

RUN apt-get update && apt-get install -y build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend deps
COPY backend/package*.json backend/
RUN cd backend && npm install

# Frontend deps
COPY frontend/package*.json frontend/
RUN cd frontend && npm install

# Source
COPY backend/ backend/
COPY frontend/ frontend/

# Build frontend
RUN cd frontend && npm run build

# Ensure data dir exists for SQLite
RUN mkdir -p backend/data

WORKDIR /app/backend
EXPOSE 3001
CMD ["npm", "start"]
