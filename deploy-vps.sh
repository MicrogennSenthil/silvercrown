#!/bin/bash
set -e

echo "=== Silver Crown VPS Deploy ==="

# Push latest to GitHub
echo "1. Pushing to GitHub..."
git push "https://MicrogennSenthil:${GITHUB_PAT}@github.com/MicrogennSenthil/silvercrown.git" main
echo "   GitHub updated."

KEY_FILE="$HOME/.ssh/sc_deploy_silvercrown"
VPS_HOST="root@72.61.231.157"
APP_DIR="/var/www/silvercrown-element"

echo "2. Connecting to VPS and deploying..."
ssh -i "$KEY_FILE" \
  -o StrictHostKeyChecking=no \
  -o ConnectTimeout=30 \
  "$VPS_HOST" \
  "cd $APP_DIR && git pull origin main && rm -rf dist && npm run build && pm2 restart silvercrown-element && echo '=== VPS deploy complete ==='"

echo "=== All done! silver.microgenn.com is updated ==="
