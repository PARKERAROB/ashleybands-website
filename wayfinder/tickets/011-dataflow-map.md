# Data-flow map: every projection chain feeding the site

type: wayfinder:research
status: open
assignee:
blocked-by:

## Question

Chart every hop between a source and what the site serves: BDOS CSVs →
sync-portal-csv.mjs → DB; events.jsonl → render_calendar.py → hand-copied
public/calendar.*; content/sources/*.md → content:build → content/*.json; anything
else (parents.csv, students.csv sync, graph projections). For each: source, script,
trigger (manual/hook/launchd), staleness window, and what flipping to DB-as-home
(ticket 001) requires. Findings → wayfinder/research/dataflow-map.md.
