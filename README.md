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

## Good next upgrades
- PostgreSQL
- S3 / MinIO
- background job queue
- AES-128 encryption
- domain allowlists
- user auth
- watermarking
- real multi-DRM
