# Forms are bespoke code, pre-filled

type: wayfinder:grilling
status: closed (2026-07-19, charting session)

## Question

Who can create a form without the other — a generic admin form builder, or forms
built as code together?

## Resolution

**Forms as code, built together ("B 100%").** No Google-Forms-style builder. Each
form Rob and Atlas build becomes a reusable template; over time the template set
covers what he typically needs. The differentiator: forms are **unique to us and
pre-filled from data we already hold** — families never re-enter known info. This
requires live reads from the DB home (confirms ticket 001). Pipeline per form:
build → live on portal → email draft to targeted roster slice (Rob sends) → response
tracking dashboard (who submitted / who hasn't) → one-click follow-up draft →
nothing lost.
