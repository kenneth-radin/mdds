# MDSS REST API image — built by Render's Docker environment from the repo root.
FROM node:22-alpine

WORKDIR /app

# Install backend dependencies first so this layer caches.
# RENDER_CACHE_BUST: incrementing this invalidates the Docker cache so npm ci
# reinstalls dependencies (e.g. firebase-admin) that weren't in a previous build.
ARG RENDER_CACHE_BUST=1
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy backend sources and compile TypeScript to /app/dist.
COPY backend/ ./
RUN npm run build

# Render injects PORT, MONGODB_URI, JWT_SECRET (etc.) at runtime.
ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/server.js"]
