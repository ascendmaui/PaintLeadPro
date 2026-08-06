# PaintPath — Greenville Homeowner App

Consumer-facing paint estimate + AI visualizer (separate from **PaintLead Pro** contractor portal).

- **Brand:** PaintPath
- **Audience:** Homeowners in Greenville / Upstate SC
- **Entry:** `/homeowner.html` (rewritten to `/` via vercel.json)
- **Voice:** Chloe via `/api/voice-agent` (Vapi when keyed) + on-page transcript + speech synthesis
- **Hero video:** `videos/paintleadpro_square.mp4` with muted autoplay + poster

## Env

Same as PaintLead Pro: `VAPI_*`, `GEMINI_API_KEY`, Supabase optional.

## Deploy

Vercel project: **paintpath-gvl** (homeowner) vs **paint-lead-pro** (contractor).
