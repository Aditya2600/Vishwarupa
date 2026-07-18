# Internal Remotion renderer service image.
# Build context MUST be ./Remotion (so the project src/ and public/ are available).
FROM node:20-bookworm-slim

ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium \
    RENDERER_PORT=3000 \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/Remotion

# Project deps first (react + remotion) — the bundle resolves these.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Renderer-service deps (@remotion/bundler + @remotion/renderer).
COPY renderer-service/package.json ./renderer-service/
RUN npm --prefix ./renderer-service install --no-audit --no-fund

# Project source + the service.
COPY . .

EXPOSE 3000

CMD ["node", "renderer-service/server.mjs"]
