# Decision: parent portal changes auto-approve (no review gate)

**Date:** 2026-06-23 · **Decided by:** Rob (so ordered) · **Status:** decided; implementation pending

## The decision
> "Portal changes by parents should be instantly approved. They are already controlled by the family via a
> login — there is no need to NOT auto-approve them. An audit log is fine." — Rob, 2026-06-23

A signed-in parent editing their own or their student's info is **already authorized by the login.** There
is nothing for a human to approve. The `needs_review` approval gate is the wrong design.

## What this means for the code
- **Parent portal writes land `approved` + logged, not `needs_review`.** The places that currently set
  `status: "needs_review"`:
  - `app/api/portal/update-request/route.js` (profile/contact edits — already mirror-applied; just drop the gate)
  - `app/api/portal/guardian-request/route.js` (parent adds a guardian)
- **Keep an audit log** — who changed what, when. The `portal_review_queue` / `/admin/profile-requests`
  view becomes an **audit log**, not an approval queue.
- The existing **~59 `needs_review` backlog** is all already-applied parent edits — clear it under this
  policy (mark approved/logged); don't hand-triage it.

## One nuance to handle at build time
A parent **adding a NEW guardian** grants a new person login access. Same family-controlled spirit, so it
**also auto-approves**, but it's the one case worth a clearly visible audit entry (and ideally a notice to
the existing trusted guardian). Default: auto-approve + log + notify.

## Supersedes
The "Rob manually triages the portal review queue" framing (Atlas task ahs-378). The fix is to remove the
gate, not to clear the queue by hand.

## Addendum 2026-07-05 — the rule is ALL portal gates, and it covers outside-in access requests

Recurred a third time: the `/portal/request` (new-email access request) lane still created
`email_verified` review items and emailed Rob "profile review needed" — because the 6-23 fix was
applied to the signed-in-parent lanes only, and this lane's gate was never even wired to grant
access (the admin "approve" button only flipped the queue status; nothing promoted the
`portal_student_people` link to `trusted`). Rob's order, restated as the general rule:

> **No portal approval gates, period. Rob approves nothing. The review queue is an audit log.**

Implemented 2026-07-05 in `app/api/portal/request/confirm/route.js`:
- Email verified + roster match → the link is created **trusted** immediately, the queue item lands
  `approved` (audit), the family gets an access-granted email, Rob's alert becomes FYI
  ("no action needed").
- Email verified + NO roster match → nothing to link; queue item lands `needs_followup` and Rob's
  email says "follow up with the family" (a conversation, not an approval).
- Matcher hardened (`app/api/portal/request/route.js`): parenthetical preferred names
  ("Riley (Vera)") now match — the 7/3 Chemburkar request scored "none" on exactly this.
- Backfilled the two stuck requests (Pritchard→Caleigh, Chemburkar→Riley) as trusted.
