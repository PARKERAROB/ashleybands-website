# band-website — ashleybands.com (LIVE site)

Downstream of BandDirectorOS (BDOS) at `~/Atlas/BandsofAHS` — the canonical brain.
Next.js + Vercel + Supabase. When in doubt, BDOS is the source of truth.

## Before changing content or structure
- Public info pages are GENERATED. Source markdown lives in `content/sources/`
  (e.g. `marching-band-2026.md`, `2026-2027-band-information.md`). Edit the SOURCE,
  then run `npm run content:build`. Never hand-edit the generated `content/*.json`.
- Dated truth = `RobOS/store/events.jsonl` (store-as-master, 2026-06-10). `/calendar` +
  `public/calendar.ics` + `public/calendar-data.json` are GENERATED from it: run
  `python3 ~/Desktop/RobOS/store/render_calendar.py`, copy `RobOS/calendar/program.{ics,json}`
  to `public/calendar.ics` / `public/calendar-data.json`, deploy. BDOS `data/calendar-2026.csv`
  is a generated projection of the same store (never hand-edit). Run `/check-site-dates`
  before shipping any date change.
- Voice/naming: short sentences, no em dashes, "Mr. Parker" (not "Rob"), "Ashley"
  (not "Eugene Ashley"). Full rules: BDOS `references/voice.md`.

## Deploy
- `/deploy-website` only. Never deploy spring-concert-2026.vercel.app.
- **CONSOLIDATED 2026-06-15: `main` now has ALL content** (`band-of-heroes-live` merged into `main`,
  no history rewrite). The old "deploying `main` drops live content" warning is now STALE — `main` is
  the full superset. Prod stays aliased from the last `band-of-heroes-live` deploy until the next
  `vercel --prod`; **going forward, work and deploy from `main`.** (Verify with `curl ashleybands.com/<route>`
  if unsure what's currently live.)
- `vercel --prod --yes` builds with Production env + aliases ashleybands.com. **Preview deploys
  (`vercel`) fail** here — env vars are scoped to Production only, so a preview `next build` exits 1
  even when the local build passes. Use prod, or fix preview-scoped env, don't chase the code.

## Comms
- Resend broadcasts + send queue are L2: draft/stage only, Rob sends. Never send.
