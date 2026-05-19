#!/bin/bash
# Silver Crown VPS Deploy Script
# Usage: bash deploy-vps.sh
# VPS app directory: /var/www/silvercrown-element
# SSH key: ~/.ssh/sc_deploy_silvercrown

set -e

APP_DIR="/var/www/silvercrown-element"
VPS_HOST="root@72.61.231.157"
KEY_FILE="$HOME/.ssh/sc_deploy_silvercrown"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "============================================"
echo "  Silver Crown VPS Deploy — $TIMESTAMP"
echo "============================================"

# Step 1: Push to GitHub
echo ""
echo "[1/3] Pushing to GitHub..."
git push "https://MicrogennSenthil:${GITHUB_PAT}@github.com/MicrogennSenthil/silvercrown.git" main
COMMIT=$(git log --oneline -1)
echo "      ✓ GitHub updated: $COMMIT"

# Step 2: Pull, build, and restart on VPS
echo ""
echo "[2/3] Connecting to VPS: $APP_DIR"
ssh -i "$KEY_FILE" \
  -o StrictHostKeyChecking=no \
  -o ConnectTimeout=30 \
  "$VPS_HOST" bash << 'REMOTE'
set -e
APP_DIR="/var/www/silvercrown-element"
cd "$APP_DIR"

echo "      → Directory : $APP_DIR"
echo "      → Pulling latest code..."
git pull origin main
echo "      → Commit: $(git log --oneline -1)"

echo ""
echo "      → Removing old build..."
rm -rf dist

echo "      → Building (this takes ~5 minutes)..."
npm run build 2>&1 | tail -8

echo ""
echo "      → Copying session table SQL..."
cp node_modules/connect-pg-simple/table.sql dist/table.sql

echo ""
echo "      → Applying DB migrations..."
npx drizzle-kit push --config=drizzle.config.ts 2>&1 | tail -5

echo ""
echo "      → Granting DB permissions..."
sudo -u postgres psql -d silvercrown_db -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO silvercrown_user; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO silvercrown_user;" 2>&1 | tail -3

echo ""
echo "      → Restarting PM2..."
pm2 restart silvercrown-element
sleep 3
pm2 list | grep silvercrown-element

echo ""
echo "      ✓ VPS deploy complete"
REMOTE

echo ""
echo "[3/3] Done!"
echo "      Production: https://silver.microgenn.com"
echo "============================================"
echo ""
