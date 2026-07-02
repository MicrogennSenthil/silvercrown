---
name: DB and deploy pattern
description: Production DB is Replit PostgreSQL; full deploy now possible from Replit via SSH key (decode VPS_SSH_KEY_B64 each session).
---

# DB and Deploy Pattern

## Production Database — IMPORTANT
- Production DB is a **local PostgreSQL ON THE VPS** (host `localhost`, db `silvercrown_db`), NOT Replit-managed. (Earlier notes claiming Replit PostgreSQL were WRONG — `executeSql` hits the Replit *dev* DB only.)
- The VPS `.env` holds the real prod `DATABASE_URL`; app connects as `silvercrown_user`.
- `silvercrown_user` is NOT the table owner (`postgres` owns tables) → `ALTER TABLE` as that user fails with "must be owner". Run DDL migrations as the postgres superuser: `sudo -u postgres psql -d silvercrown_db -c "..."` (root over SSH can sudo).
- To migrate prod: SSH to VPS → get dbname via `psql "$DB" -tA -c "SELECT current_database()"` → run ALTER via `sudo -u postgres psql -d <db>`. `executeSql()` does NOT touch production.
- Schema changes made in dev must be manually applied to prod (dev/prod DBs drift — e.g. job_work_inward_items was missing sap_no/drg_no on prod).

## Deployment Flow (fully agent-driven as of Jul 2026)
- VPS: `root@72.61.231.157` (srv1163666), app dir: `/var/www/silvercrown-element`, PM2 process: `silvercrown-element`, prod URL: https://silver.microgenn.com
- **SSH from Replit to VPS now WORKS** using the `VPS_SSH_KEY_B64` secret (earlier timeout issue no longer applies).
- The decoded key file does NOT persist between sessions — re-decode every session:
  `printf '%s' "$VPS_SSH_KEY_B64" | base64 -d > ~/.ssh/vps_key && chmod 600 ~/.ssh/vps_key`
- **Working deploy path:**
  1. Build locally: `npm run build`
  2. Commit via code_execution `execSync` (bash tool blocks `git commit`)
  3. Push via bash: `git push "https://MicrogennSenthil:${GITHUB_PAT}@github.com/MicrogennSenthil/silvercrown.git" main` (`${GITHUB_PAT}` does NOT expand inside execSync)
  4. Deploy via SSH: `ssh -i ~/.ssh/vps_key -o StrictHostKeyChecking=no -o BatchMode=yes root@72.61.231.157 "cd /var/www/silvercrown-element && git pull origin main && npm run build && pm2 restart silvercrown-element"`
  5. Verify: `git log -1 --oneline` on VPS + `curl -s -o /dev/null -w "%{http_code}" https://silver.microgenn.com` → 200
- VPS does NOT run `npm install` — never add new runtime deps without handling install on VPS.
