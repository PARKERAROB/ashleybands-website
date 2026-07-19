# Schema + admin coverage audit

type: wayfinder:research
status: open
assignee:
blocked-by:

## Question

What's actually in the prod DB today, and how much of it already has an admin screen?
Enumerate every table (live DB via the Management API, per
RobOS/references/band-website-ops.md), note which hold person data / inventory /
payments, which admin routes exist and what they cover, and the gap list: tables with
no UI, UIs with no edit, inventory tables present or absent (instruments, lockers,
music, uniforms). This sizes the admin build and grounds the IA prototype.
Findings → wayfinder/research/schema-admin-coverage.md.
