#!/usr/bin/env bash
# Run from repo root: ./scripts/deploy.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "--- Git pull ---"
git pull origin main

echo "--- Backend ---"
(cd backend && npm ci --omit=dev)
pm2 restart video-backend || true

echo "--- Frontend ---"
(cd frontend && npm ci --omit=dev && npm run build)
pm2 restart video-frontend || true

pm2 save
echo "Deploy done."
