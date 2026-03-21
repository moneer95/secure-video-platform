#!/usr/bin/env bash
# Run from repo root: ./scripts/deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# PM2/git must be on PATH (nvm: start PM2 from an interactive shell once, or symlink pm2 into /usr/local/bin)
command -v git >/dev/null 2>&1 || { echo "deploy: git not in PATH"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "deploy: pm2 not in PATH (install: npm i -g pm2)"; exit 1; }

echo "--- Git pull ---"
git pull origin main

echo "--- Backend ---"
(cd backend && npm i)
pm2 restart video-backend

echo "--- Frontend ---"
(cd frontend && npm i && npm run build)
pm2 restart video-frontend

pm2 save
echo "Deploy done."
