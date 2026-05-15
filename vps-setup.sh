#!/bin/bash
# ============================================================
#  Silver Crown Element ERP — VPS FIRST-TIME SETUP SCRIPT
#  Run this ONCE on your VPS to set up the app for the first time.
#  This script is ISOLATED — it will NOT touch any other app.
# ============================================================

set -e

APP_DIR="/var/www/silvercrown-element"
LOG_DIR="/var/log/silvercrown-element"
GITHUB_REPO="https://github.com/MicrogennSenthil/silvercrown.git"
APP_NAME="silvercrown-element"
PORT=5100

echo "======================================================"
echo "  Silver Crown Element ERP — First-Time VPS Setup"
echo "======================================================"

# 1. Create log directory for this app only
echo "[1/7] Creating log directory at $LOG_DIR ..."
mkdir -p "$LOG_DIR"

# 2. Clone the repository into its own isolated folder
echo "[2/7] Cloning repository into $APP_DIR ..."
if [ -d "$APP_DIR" ]; then
  echo "  Directory already exists. Pulling latest instead..."
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$GITHUB_REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# 3. Install Node dependencies (isolated to this app's folder)
echo "[3/7] Installing Node.js dependencies ..."
npm install

# 4. Build the production bundle
echo "[4/7] Building production bundle ..."
npm run build

# 5. Run database migrations (isolated to this app's DB)
echo "[5/7] Running database migrations ..."
npm run db:push

# 6. Create/update uploads directory
echo "[6/7] Creating uploads directory ..."
mkdir -p "$APP_DIR/uploads"

# 7. Start the app with PM2 under a unique name — won't affect other apps
echo "[7/7] Starting app with PM2 (name: $APP_NAME, port: $PORT) ..."
pm2 start "$APP_DIR/ecosystem.config.cjs" --only "$APP_NAME"
pm2 save

echo ""
echo "======================================================"
echo "  Setup complete!"
echo "  App running on port $PORT"
echo "  PM2 name: $APP_NAME"
echo "  Logs: $LOG_DIR"
echo "  To check status: pm2 status $APP_NAME"
echo "  To view logs:    pm2 logs $APP_NAME"
echo "======================================================"
