# band-website — ashleybands.com (LIVE site)

Downstream of BandsofAHS (BDOS) at `~/Atlas/BandsofAHS` — the canonical brain.
Next.js + Vercel + Supabase. When in doubt, BDOS is the source of truth.

## Before changing content or structure
- Public info pages are GENERATED. Source markdown lives in `content/sources/`
  (e.g. `marching-band-2026.md`, `2026-2027-band-information.md`). Edit the SOURCE,
  then run `npm run content:build`. Never hand-edit the generated `content/*.json`.
- Dated truth = `RobOS/store/events.jsonl` (store-as-master, 2026-06-10). `/calendar` +
  `public/calendar.ics` + `public/calendar-data.json` are GENERATED from it: run
  `python3 ~/Atlas/RobOS/store/render_calendar.py`, copy `RobOS/calendar/program.{ics,json}`
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

## Family portal
- **NO portal approval gates, period (Rob 2026-06-23, re-ordered 2026-07-05 after a 3rd recurrence).**
  Rob approves NOTHING in the portal: signed-in parent changes AND outside-in access requests
  (`/portal/request`) all auto-approve; a verified email with a roster match gets a `trusted` link
  immediately. The `/admin/profile-requests` queue is an **audit log**, not an approval gate. The only
  human case is a no-roster-match request = a family FOLLOW-UP, never an approval. Any new portal
  feature that emails Rob an "approve" ask violates this decision. Full history + addendum:
  `docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md`.

## Comms
- Resend broadcasts + send queue are L2: draft/stage only, Rob sends. Never send.

## Data rules (compliant plan, 2026-07-10)
- **No grades, ever.** No coursework, GPA, or required-for-class features, full stop. Verified
  clean in the schema as of 2026-07-10; keep it that way.
- **Contact values are family-owned, not CSV-mirrored.** `sync-portal-csv.mjs` is guarded to never
  push parent/student email or phone from the BDOS CSVs into the hosted DB — those values come only
  from the family via portal request/confirmation. Don't remove that guard.
- **Every new person-data column/table carries a source/provenance tag.** A `source` (or
  `source_*`) column on the table, or an explicit `-- provenance: ...` comment in the same
  migration file. Enforced by `npm run lint:provenance` (`scripts/provenance-lint.mjs`) for
  migrations after the 2026-07-10 baseline (0001-0028 are grandfathered — see the script header).
- **Person-data reads/writes in admin routes call `logAudit`** (`lib/auditLog.js`). Every admin
  route that selects or mutates a person-data table logs actor + action; a logging failure never
  blocks the request, but the call itself is not optional.
