---
name: DB and deploy pattern
description: Production DB is Replit PostgreSQL; VPS SSH from Replit times out; deploy via GitHub PAT push then manual VPS pull.
---

# DB and Deploy Pattern

## Production Database
- Hosted on **Replit PostgreSQL** — NOT on the VPS local DB.
- VPS app connects to Replit DB via `DATABASE_URL` environment variable.
- Run migrations using `executeSql()` in code_execution — this hits the live Replit DB directly.
- Always check column names with `information_schema.columns` before writing migration SQL (e.g. `voucher_series` uses `transaction_type` not `series_key`).

## Deployment Flow
- VPS: `root@72.61.231.157`, app dir: `/var/www/silvercrown-element`, PM2 process: `silvercrown-element`
- **SSH from Replit to VPS times out** — direct SCP/SSH deploys don't work from Replit's network.
- **Working deploy path:**
  1. Build locally: `npm run build`
  2. Push to GitHub via PAT inline URL: `git push "https://MicrogennSenthil:${GITHUB_PAT}@github.com/MicrogennSenthil/silvercrown.git" main`
  3. User SSHs to VPS from their local machine and runs: `cd /var/www/silvercrown-element && git pull && npm run build && pm2 restart silvercrown-element`
- `GITHUB_PAT` is available as a Replit environment secret.
- `VPS_SSH_KEY_B64` is available but SSH from Replit is blocked by network routing.
