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
