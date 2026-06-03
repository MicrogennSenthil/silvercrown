#!/bin/bash
# Silver Crown VPS Deploy Script
# Strategy: build locally → SCP dist → restart PM2 (no VPS-side build needed)
# Usage: bash deploy-vps.sh
# VPS app directory: /var/www/silvercrown-element

APP_DIR="/var/www/silvercrown-element"
VPS_HOST="root@72.61.231.157"
KEY_FILE="$HOME/.ssh/sc_deploy_silvercrown"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "============================================"
echo "  Silver Crown VPS Deploy — $TIMESTAMP"
echo "============================================"

# ── 0. Reconstruct SSH key ────────────────────────────────────────────────────
if [ -n "$VPS_SSH_KEY_B64" ]; then
  mkdir -p "$HOME/.ssh"
  echo "$VPS_SSH_KEY_B64" | base64 -d > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "      ✓ SSH key restored from secret"
elif [ ! -f "$KEY_FILE" ]; then
  echo "ERROR: No SSH key available. Set VPS_SSH_KEY_B64 secret in Replit."
  exit 1
fi

SSH="ssh -i $KEY_FILE -o StrictHostKeyChecking=no -o ConnectTimeout=30"
SCP="scp -i $KEY_FILE -o StrictHostKeyChecking=no"

# ── 1. Push committed changes to GitHub (best-effort, no fail) ────────────────
echo ""
echo "[1/4] Pushing to GitHub..."
if [ -n "$GITHUB_PAT" ]; then
  git push "https://MicrogennSenthil:${GITHUB_PAT}@github.com/MicrogennSenthil/silvercrown.git" main 2>&1 || true
fi
echo "      ✓ Commit: $(git log --oneline -1)"

# ── 2. Build locally ──────────────────────────────────────────────────────────
echo ""
echo "[2/4] Building locally..."
npm run build 2>&1 | tail -6
echo "      ✓ Build complete"

# ── 3. SCP dist to VPS ────────────────────────────────────────────────────────
echo ""
echo "[3/4] Uploading dist to VPS..."
$SCP -r dist/public dist/index.cjs "$VPS_HOST:$APP_DIR/dist/" 2>&1
echo "      ✓ Upload complete"

# ── 4. Restart PM2 ────────────────────────────────────────────────────────────
echo ""
echo "[4/4] Restarting PM2..."
$SSH "$VPS_HOST" "pm2 restart silvercrown-element && sleep 2 && pm2 list | grep silvercrown-element" 2>&1

echo ""
echo "============================================"
echo "  ✓ Deploy complete!"
echo "  Production: https://silver.microgenn.com"
echo "============================================"
echo ""
