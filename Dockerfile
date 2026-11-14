# Image for the Fastify API (services/api), deployed as a Cloudflare Container (issue #43).
# Built by `wrangler deploy` from the repo root (see wrangler.jsonc). Works from main and from
# claude/14-deepgram-asr-v2. Cloudflare runs linux/amd64 only; wrangler builds with --platform linux/amd64.
FROM node:22-bookworm-slim

WORKDIR /app

# Install inside the image so esbuild (used by tsx) gets its Linux binary.
# Plain `npm ci`, not --omit=dev: on main, tsx and ws are devDependencies.
# NODE_ENV stays unset before this line because NODE_ENV=production would also drop devDependencies.
COPY package.json package-lock.json ./
# npm workspaces needs each workspace manifest present before `npm ci`.
COPY apps/glasses/package.json ./apps/glasses/package.json
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Runtime sources only. .dockerignore allow-lists what gets here and keeps .env and secrets out.
COPY . .

# Build the web display into the path served by the API's /display/ routes.
RUN npm run build:glasses

# The server must listen on all interfaces so the Container's port proxy can reach it.
# The Worker passes the same values, plus the secrets, at start().
ENV HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080

# Unprivileged user. The app only reads files from /app.
USER node

# Same as `npm start` (tsx on services/api/src/index.ts) minus the .env loading, which has nothing to load here.
# Node runs as PID 1 so Cloudflare's SIGTERM reaches the server's own shutdown handler and it exits 0.
# Under `npm start`, npm reported "command failed, signal SIGTERM" and exited 1 on `docker stop`.
CMD ["node", "--import", "tsx", "services/api/src/index.ts"]
