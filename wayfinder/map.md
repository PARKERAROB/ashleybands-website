# WAYFINDER MAP — ashleybands.com to full operational capacity

label: wayfinder:map
opened: 2026-07-19
deadline: 2026-07-26 (Sunday)

## Destination

The hosted Supabase DB is the single live home for all site data. Rob sees and edits
everything through admin screens at ashleybands.com — no Claude Code, no Supabase
dashboard. Families see and trust their own data. Forms, payments ledger, inventories
(instruments, lockers/locks, music, uniforms), calendar, and info pages all run live
end to end by Sunday 2026-07-26.

## Notes

- **Execution rides this map.** The 1-week deadline overrides plan-only: once a
  decision ticket closes, build tickets graduate from the fog and are worked (AFK
  where possible, nightly work runs allowed). Rob reviews on the LIVE site, never
  localhost.
- Domain doctrine that binds every ticket: band-website/CLAUDE.md (data rules, no
  grades ever, provenance tags, logAudit), boundary-and-trust (send is L2 always,
  deploy narrowing: band-website deploys are Atlas-owned via `vercel --prod --yes`).
- Rob's stated priority order if the week runs short:
  1. Data flow flipped + admin screens (trust foundation)
  2. First real form live end to end (proves the pipeline)
  3. Payments ledger
  4. Inventories
  5. Calendar + info pages verified current
- Skills to consult per ticket: /grilling, /domain-modeling, /prototype, /research,
  /to-spec for the build handoff.
- Tracker: local-markdown (this file + `tickets/`). A ticket is claimed when its
  `assignee:` line is set. Blocking = `blocked-by:` frontmatter. Frontier = open +
  unblocked + unassigned.

## Decisions so far

- [DB is the home — flip the data flow](tickets/001-db-is-the-home.md) — Supabase DB
  becomes the single home for site data; BDOS CSVs/files become dated projections FROM it.
- [Admin covers everything](tickets/002-admin-covers-everything.md) — full admin UI for
  all data; no Supabase-dashboard fallback accepted.
- [Safe = not silent, not stale](tickets/003-safe-means-not-silent-not-stale.md) —
  trust is freshness + visibility; structure over alarms; projections stamped.
- [Forms are bespoke code, pre-filled](tickets/004-forms-bespoke-prefilled.md) — no
  generic form builder; built together, pre-filled from live data, become templates.
- [Payments: full ledger](tickets/005-payments-full-ledger.md) — family balance view +
  admin check-recording; PayPal stays; fair share + trip first.
- [Inventory list: instruments, lockers/locks, music, uniforms](tickets/006-inventory-list.md)
  — site DB data is the most-current starting truth.
- [Week priority order](tickets/007-week-priority-order.md) — flow-flip+admin → first
  form → payments → inventories → calendar/info verification.

## Not yet specified

- Per-domain admin screen specs (waits on the schema/coverage audit + admin IA prototype).
- The build tickets themselves — flow-flip migration, admin CRUD, form #1, ledger,
  inventory screens — graduate as their decision tickets close.
- Payment ledger data model + reconciliation with the existing PayPal/check audit trail
  (waits on the charges-model grilling).
- Inventory mechanics per type: checkout model for instruments/lockers, music library
  structure, uniform assignment.
- Form template catalog beyond form #1.
- Follow-up/email mechanics: Resend staging, per-form recipient tracking (send stays Rob's).
- What BDOS needs FROM the DB once the flow flips (projection regeneration, sync scripts
  reversed or retired).
- Backup/restore: what to enable and a real restore drill (waits on backup-state research).

## Out of scope

- Grades, coursework, GPA, required-for-class features — permanent data rule, never in
  any destination.
- Public-site redesign / new marketing content — this week verifies currency, nothing more.
- Generic Google-Forms-style form builder — ruled out in charting (see Forms decision).
- Automating sends — drafting/staging only; Rob sends, invariant.
- spring-concert-2026.vercel.app — never touched, never deployed.
