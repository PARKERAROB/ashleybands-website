# Safe = not silent, not stale

type: wayfinder:grilling
status: closed (2026-07-19, charting session)

## Question

What earns "the data is safe" — what failure is Rob guarding against?

## Resolution

Rob: **"Silent and Stale are my problems. Especially stale when it comes to working
with you."** Safe means: (1) no silent change — audit log + provenance visible on the
admin screens, not buried in tables; (2) no stale copy — freshness by structure (the
DB-as-home flip, ticket 001), with every remaining projection stamped as-of + source.
Backups/export matter but are secondary to freshness+visibility; leak-prevention (#3
in the grill) is existing doctrine, verified not built. The backup-state research
ticket covers the can't-be-lost layer.
