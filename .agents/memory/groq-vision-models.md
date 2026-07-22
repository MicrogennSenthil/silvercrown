---
name: Groq vision model availability
description: Which AI scan models actually work for the DC/invoice scanning feature
---
As of July 2026, Groq removed ALL Llama vision models (llama-4-scout, llama-4-maverick, llama-3.2-vision). The only vision-capable Groq model is `qwen/qwen3.6-27b` (input_modalities text+image).

**Why:** Scan feature broke with "model does not exist" — verify against `GET https://api.groq.com/openai/v1/models` (check `input_modalities`) before picking a model, don't trust remembered model names.

**How to apply:** The active model lives in `app_settings` (category 'AI Configuration', key `ai_model`) — on the VPS production DB, not just Replit dev DB; both must be updated. Gemini key in DB is free-tier and quota-limited; `gemini-1.5-*`/`gemini-2.5-flash*` return 404 for this key — use `gemini-flash-latest`.
