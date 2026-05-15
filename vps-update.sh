#!/bin/bash
# ============================================================
#  Silver Crown Element ERP — VPS UPDATE / REDEPLOY SCRIPT
#  Run this after every GitHub push to update the live app.
#  This script ONLY restarts silvercrown-element — nothing else.
# ============================================================

set -e

APP_DIR="/var/www/silvercrown-element"
APP_NAME="silvercrown-element"

echo "======================================================"
echo "  Silver Crown Element ERP — Updating Live App"
echo "======================================================"

cd "$APP_DIR"

# 1. Pull latest code from GitHub
echo "[1/4] Pulling latest code from GitHub ..."
git pull origin main

# 2. Install any new dependencies
echo "[2/4] Installing dependencies ..."
npm install

# 3. Rebuild production bundle
echo "[3/4] Building production bundle ..."
npm run build

# 4. Zero-downtime reload — ONLY this app, cluster mode
echo "[4/4] Reloading $APP_NAME (zero-downtime cluster reload) ..."
pm2 reload "$APP_NAME"

echo ""
echo "======================================================"
echo "  Update complete!"
echo "  To check status: pm2 status $APP_NAME"
echo "  To view logs:    pm2 logs $APP_NAME"
echo "======================================================"
