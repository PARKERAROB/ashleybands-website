# band-website — ashleybands.com (LIVE site)

Downstream of BandDirectorOS (BDOS) at `~/Desktop/BandsofAHS` — the canonical brain.
Next.js + Vercel + Supabase. When in doubt, BDOS is the source of truth.

## Before changing content or structure
- Public info pages are GENERATED. Source markdown lives in `content/sources/`
  (e.g. `marching-band-2026.md`, `2026-2027-band-information.md`). Edit the SOURCE,
  then run `npm run content:build`. Never hand-edit the generated `content/*.json`.
- Site dates must match BDOS `data/calendar-2026.csv`. Run `/check-site-dates` before
  shipping any date change.
- Voice/naming: short sentences, no em dashes, "Mr. Parker" (not "Rob"), "Ashley"
  (not "Eugene Ashley"). Full rules: BDOS `references/voice.md`.

## Deploy
- `/deploy-website` only. Never deploy spring-concert-2026.vercel.app.

## Comms
- Resend broadcasts + send queue are L2: draft/stage only, Rob sends. Never send.
