# Frontend

This is the active Vite + React app for the personalized video generator.

## Local Development

```bash
cd Frontend
npm install
npm run dev
```

Open `http://127.0.0.1:8080`.

The app always calls the backend through `/api`, and Vite proxies that to `http://127.0.0.1:8000` during development.

## Docker

Build:

```bash
cd Frontend
docker build -t personalized-video-frontend .
```

Run:

```bash
docker run --rm -p 8080:80 personalized-video-frontend
```

Docker default:

- `BACKEND_ORIGIN=http://backend:8000`

Override the backend origin at runtime if needed:

```bash
docker run --rm \
  --network app-network \
  -p 8080:80 \
  -e BACKEND_ORIGIN=http://heygen-backend:8000 \
  personalized-video-frontend
```

For local one-off Docker runs outside a shared Docker network, set `BACKEND_ORIGIN` to an address the container can resolve.

The Nginx template proxies both `/api` and `/artifacts` to the backend, so avatar, remotion, auth, drafts, and video playback all work through the same frontend container.

## Key Files

- `src/pages/Index.tsx`
- `src/pages/MyVideos.tsx`
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `src/store/wizardStore.ts`
- `src/lib/api.ts`
- `nginx.conf.template`
- `Dockerfile`
