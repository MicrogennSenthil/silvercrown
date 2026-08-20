---
name: Publishing fallback
description: What to do when the configured GitHub credential cannot push a verified production change.
---

# Publishing fallback

**Rule:** If both the configured GitHub remote and the stored GitHub credential reject a push, do not assume the repository has been updated. For an urgent, verified production fix, transfer only the changed source files over the existing keyed SSH connection, then rebuild and restart the production service.

**Why:** The Git publishing credential can become invalid independently of the working VPS SSH access. A direct, minimal-file deployment keeps the live application current without fabricating repository state, while making the credential repair a separate follow-up.

**How to apply:** Build locally first, deploy only the reviewed changed files, build again on the VPS, restart the relevant PM2 workers, and verify the public site responds. Create a maintenance task to restore normal Git publishing before relying on the next deployment.