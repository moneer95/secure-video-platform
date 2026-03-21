# Secure Video Platform Starter

## What it does
- Upload raw MP4 videos
- Save a database record in SQLite
- Auto-convert to HLS with FFmpeg
- Generate a protected player link and iframe embed
- Serve HLS files through signed expiring playback tokens

## Requirements
- Node.js 18+
- FFmpeg installed and available in PATH

Check FFmpeg:
```bash
ffmpeg -version
```

## Run backend
```bash
cd backend
npm install
node server.js
```

Backend runs on:
```text
http://localhost:4000
```

Backend environment (recommended for production):
- `PORT`: backend port (default `4000`)
- `APP_SECRET`: used to sign playback tokens (**set a strong secret in prod**)
- `ADMIN_KEY`: admin API key (**set a strong key in prod**)
- `PUBLIC_BASE_URL`: the public URL where the backend is reachable (used to generate `embedUrl`), e.g. `https://api.yourdomain.com`
- `CORS_ORIGINS`: comma-separated allowlist for browser requests, e.g. `https://dashboard.yourdomain.com,https://www.yourdomain.com` (default `http://localhost:3000`)
- `CATEGORIES`: comma-separated names used to seed the categories table on first run (e.g. `Tutorials,Marketing,Training,Education,Other`). After that, categories are managed via the dashboard **Categories** page (CRUD).

Admin key default:
```text
admin-demo-key
```

## Run frontend
Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:
```text
http://localhost:3000
```

Frontend environment:
- `NEXT_PUBLIC_API_BASE_URL`: backend base URL, e.g. `https://api.yourdomain.com` (default `http://localhost:4000`)
- `NEXT_PUBLIC_ADMIN_KEY`: admin API key to call the backend (default `admin-demo-key`)

## Flow
1. Open the frontend dashboard
2. Upload an MP4
3. Backend stores it and starts FFmpeg conversion
4. When status becomes `ready`, open the manage page
5. Copy the secure embed code or preview the protected player

## Important limitation
This is not full commercial DRM. It is strong starter protection:
- signed expiring tokenized playback
- protected manifests and segments
- simple anti-hotlinking structure

It does not provide:
- Widevine
- FairPlay
- true DRM license servers

## CI/CD: GitHub Webhook → deploy on the server

No GitHub Actions. When you **push to `main`**, GitHub sends a webhook to your server; the backend verifies it and runs the deploy script (git pull, build, PM2 reload).

### One-time server setup

1. **Node.js 18+** and **FFmpeg** installed.
2. **PM2** globally: `npm install -g pm2`.
3. **Clone the repo** on the server and do an initial deploy (see Manual deploy below).
4. **Backend env**: In `backend/.env` set **`GITHUB_WEBHOOK_SECRET`** (same value you’ll set in GitHub in the next step).

### Add the webhook in GitHub

1. Open your repo on GitHub → **Settings** → **Webhooks** → **Add webhook**.
2. **Payload URL**: your backend URL + `/api/webhook/deploy`, e.g. `https://api.yourdomain.com/api/webhook/deploy`. Must be reachable from the internet.
3. **Content type**: `application/json`.
4. **Secret**: generate one (e.g. run `openssl rand -hex 32`) and paste it. **Use the same value** in `backend/.env` as `GITHUB_WEBHOOK_SECRET`.
5. **Which events**: choose **Just the push event** (or “Let me select…” and tick “Pushes”).
6. Save. GitHub will send a POST to that URL on every push; the backend only runs the deploy when `ref` is `refs/heads/main`.

You don’t need any Actions or repository secrets. GitHub calls your server automatically when you push.

### PM2 on the server

- **Backend**: `video-backend`. **Frontend**: `video-frontend` (Next on port 3000).
- Config file is **`ecosystem.config.cjs`** at the **repo root** (not inside `frontend/` or `backend/`).

**Start or restart from repo root:**

```bash
cd ~/secure-video-platform
pm2 start ecosystem.config.cjs
# or to restart after deploy:
pm2 restart video-backend video-frontend
pm2 save
```

Do not run `pm2 start` from inside `frontend/` or `backend/`; PM2 expects the ecosystem file at the path above.

### Manual deploy

From the server, from repo root:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

---

## Good next upgrades
- PostgreSQL
- S3 / MinIO
- background job queue
- AES-128 encryption
- domain allowlists
- user auth
- watermarking
- real multi-DRM
