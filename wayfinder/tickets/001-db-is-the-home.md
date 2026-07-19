# DB is the home — flip the data flow

type: wayfinder:grilling
status: closed (2026-07-19, charting session)

## Question

To kill "stale," which direction does the data flow — is the website's database the
home for site data, or a projection of BDOS files?

## Resolution

**The hosted Supabase DB is the home** for everything families touch or Rob edits:
roster, contacts, forms, payments, inventory. BDOS CSVs and local files become
generated, dated projections FROM the DB — the reverse of today's flow (BDOS CSVs →
sync-portal-csv.mjs → DB). Rob's exact words on learning the current direction:
"I thought it was already A..." — the system must match the model already in his head.
Staleness becomes structurally impossible on the site; the stale risk moves to the
Atlas-side projections, where dated stamps make it loud instead of silent.

Calendar was flagged as the one per-domain exception to decide separately
(events.jsonl masters Rob's whole world, not just band) — see the calendar ticket.
