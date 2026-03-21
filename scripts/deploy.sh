#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/deploy-manual.log"
exec >> "$LOG" 2>&1

echo "===== $(date) deploy started ====="
echo "USER=$(whoami)"
echo "PWD=$(pwd)"
echo "PATH=$PATH"

# If using nvm, load it explicitly
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

command -v git || { echo "git not found"; exit 1; }
command -v node || { echo "node not found"; exit 1; }
command -v npm || { echo "npm not found"; exit 1; }
command -v pm2 || { echo "pm2 not found"; exit 1; }

echo "--- versions ---"
node -v
npm -v
pm2 -v

echo "--- Git pull ---"
git pull origin main

echo "--- Backend ---"
cd "$ROOT/backend"
npm ci
pm2 restart video-backend
cd "$ROOT"

echo "--- Frontend ---"
cd "$ROOT/frontend"
npm ci
npm run build
pm2 restart video-frontend
cd "$ROOT"

pm2 save
echo "===== deploy done ====="