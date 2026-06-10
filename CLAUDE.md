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
- **Prod tracks `band-of-heroes-live`, NOT `main` (observed 6/10).** `/band-of-heroes` is live;
  `/tycoon` (only on `main`) 404s in prod. Deploying `main` would drop live content — check the
  live site (`curl ashleybands.com/<route>`) before assuming which branch is production.
- `vercel --prod --yes` builds with Production env + aliases ashleybands.com. **Preview deploys
  (`vercel`) fail** here — env vars are scoped to Production only, so a preview `next build` exits 1
  even when the local build passes. Use prod, or fix preview-scoped env, don't chase the code.

## Comms
- Resend broadcasts + send queue are L2: draft/stage only, Rob sends. Never send.
