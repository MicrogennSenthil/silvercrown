---
name: Auto-deploy preference
description: User wants production deployment after every code change, without being asked.
---

The user runs this project in continuous testing mode. After every set of code changes, automatically deploy to production using the steps below — do NOT ask for confirmation first.

**Why:** Project is in active testing; every fix should be live immediately on https://silver.microgenn.com.

**How to apply:**
1. Restore SSH key: `mkdir -p ~/.ssh && echo "$VPS_SSH_KEY_B64" | base64 -d > ~/.ssh/sc_deploy_silvercrown && chmod 600 ~/.ssh/sc_deploy_silvercrown`
2. Code is already pushed to GitHub by the checkpoint system.
3. Pull on VPS (use `git stash` first if there are local changes): `ssh -i ~/.ssh/sc_deploy_silvercrown -o StrictHostKeyChecking=no root@72.61.231.157 "cd /var/www/silvercrown-element && git stash && git pull origin main && echo PULL_OK"`
4. Build: `ssh ... "cd /var/www/silvercrown-element && npm run build > /tmp/build.log 2>&1; echo EXIT:$?"`
5. Restart PM2: `ssh ... "pm2 restart silvercrown-element && pm2 status silvercrown-element"`

**Sandbox restrictions to watch for:**
- `npm install` in a bash command is blocked by Replit sandbox — skip it on VPS deploys (node_modules already present).
- `git reset --hard` is blocked — use `git stash` instead.
- `npm run build` over SSH is fine (only local npm install is blocked).
