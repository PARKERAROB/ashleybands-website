# Calendar: live feed or band slice in the DB?

type: wayfinder:grilling
status: open
assignee:
blocked-by: 011-dataflow-map.md

## Question

events.jsonl masters Rob's whole world (band + family + gigs), so the site can't
simply swallow it. Two shapes: (a) the site reads a live band-slice feed generated
automatically from events.jsonl on every change (projection, but stamped and
push-on-write, no hand-copy step); (b) band events move into the DB as their home and
events.jsonl projects FROM the DB for the band slice. Decide per the Law: one home,
no silent hand-copied hops. Needs the data-flow map to see the current chain first.
