# Carnegie funding progress

The homepage and `/support-carnegie` show net receipts toward the director-approved $250,000
campaign goal and $25,000 first major milestone (September 11, 2026; issue #80).
Since issue #93 (September 23, 2026) the display measures progress against the $25,000 first goal
until it is reached, then against the full goal. The full goal is labeled an estimate until final
prices are known. The accounting and public aggregate are unchanged.
This measures money received toward the trip, not the current bank balance or remaining cash after
trip expenses. Transfers between accounts and vendor payments are not new fundraising receipts.

`lib/carnegieFunding.mjs` owns the accounting rules. The server queries all received/refunded
`fee_payments` in the `carnegie_2027` category namespace and `sponsor_gifts` designated
`carnegie-2027`. Family credits and adjustments are not money received. Offline cash/check
payments require a recorded receipt date; staff confirmation of a check is not bank clearance.
Other offline methods require reconciliation before a total is published. General sponsorships
remain excluded even when attributed to a student.

PayPal capture reads must match ledger capture ID, invoice, USD amount, and completed/refund status.
Actual `seller_receivable_breakdown.net_amount` supplies the amount after fees. Refunded captures
also require complete order refund evidence and actual `seller_payable_breakdown.net_amount`
debits. Retained refund fees stay deducted. See
[PayPal capture financial breakdown](https://developer.paypal.com/sdk/orders/v2/definitions/capture/).
No estimated fee percentages, live charges, or refund mutations are used.

`GET /api/carnegie-2027/funding` exposes only aggregate cents, goals, and check time. The server
caches the aggregate for 60 seconds and browsers refresh every minute. Revalidation may briefly
serve the prior timestamp. A cached total older than five minutes, such as after idle time, is
verified again before the response rather than withheld (issue #98); the route still refuses any
total older than five minutes. Missing processor details, duplicates, ledger failures, or ambiguous
refunds withhold the entire total, never an understated partial sum or a fabricated zero. Existing
payment capture and receipt flows remain unchanged.

New campaign gifts and Carnegie family payments update automatically once confirmed. Other
fundraiser proceeds must first be recorded and designated in the owning ledger; bank transfers and
unrecorded offline receipts cannot be inferred. Future non-cash/check sources need an explicit
net-cost contract before inclusion. Person data and processor identifiers stay on the server.

## Student credit (issue #103)

A Carnegie gift may carry a student credit (`portal_student_id`) from a Carnegie student link
(`/support/{code}/carnegie`) or a staff-recorded check memo. It is record-keeping only: the same
amount counts once in this campaign total and appears as that student's Carnegie credit
(`carnegie_student_credit_totals`, `carnegieStudentCreditTotals`, staff-only). It is not a balance,
never reduces what a family owes, and never enters marching figures: per-student marching and
sponsorship math counts only `general` gifts. Staff-recorded offline Carnegie gifts use the existing
confirmation and receipt path and are never auto-published. Whether student credit may later apply
to trip costs is undecided.

## Student-reported gifts (issue #106, gated)

A family may report cash or a check a student collected (`carnegie_reported_gifts`). A report is not
a gift: no total reads that table and no receipt is sent. Staff confirm it through the #103 offline
path (`createPendingGift` with the report id as the idempotency key, then `confirmGift`), which makes
exactly one confirmed Carnegie gift credited to the student, or reject it with a reason. The history
keeps the reported and confirmed amounts. Hidden until `CARNEGIE_LETTERS_MODE` is set.

Check `node --test scripts/carnegie-funding.test.mjs` and the deployed public endpoint after release.
No live values or donor information belong in test fixtures, issue comments, or this document.
