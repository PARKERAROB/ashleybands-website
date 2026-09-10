# Carnegie campaign giving review

Prepared September 10, 2026 for issue #71. **Implemented locally; not published.**

The homepage's opening action and How to help section say **Support Ashley’s Carnegie Trip**.
Both display the booster nonprofit statement beside the action. `/support-carnegie` offers personal
donations and business sponsorships through the existing online/check flow, explains the charitable
recipient and trip purpose, and links to fundraisers and larger-gift inquiries.

## Copy for review

> Gifts are received by Ashley High School Band Boosters, a registered 501(c)(3) nonprofit organization. Contributions are tax-deductible to the extent allowed by law. EIN: 20-5605218.

Proposed trip-change terms, requiring acceptance as part of pre-publication review:

> If the trip is canceled or your gift cannot be used for this purpose, the boosters will contact you about a refund or your permission to redirect the gift. Any funds remaining after trip expenses will be handled the same way.

The campaign checkout includes no merchandise, tickets or advertising package. Personal donations are
not automatically published. Sponsorship recognition remains staff-controlled. A campaign donation is
not a student fee payment or an individual student balance.

## Source verification

The IRS [Exempt Organizations Business Master File](https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf), updated September 8, 2026, was retrieved September 10.
The [North Carolina extract](https://www.irs.gov/pub/irs-soi/eo_nc.csv) contains EIN 205605218,
ASHLEY HIGH SCHOOL BAND BOOSTERS, subsection 03, deductibility 1, status 01, ruling 200705.
The IRS [code definitions](https://www.irs.gov/pub/foia/ig/tege/eo-info.pdf) identify deductible
contributions and unconditional exemption. This verifies the public assertion without substituting
for the organization's retained determination letter.

Receipt and deduction wording follows IRS [substantiation guidance](https://www.irs.gov/charities-non-profits/substantiating-charitable-contributions).

## Implementation and verification

- Additive migration `202609100001_sponsor_gift_campaign.sql` adds `campaign_code` and `gift_kind`.
  All historical gifts default to general support; no old gifts are reclassified.
- Creation validates campaign and gift type. Idempotency includes campaign, type and trusted
  attribution, so a retried request cannot move a gift to another purpose or student.
- Check instructions, PayPal descriptions, receipts and private staff totals retain the purpose.
  Pending, refunded and void gifts are excluded from confirmed campaign totals.
- Campaign gifts start with zero goods/services value because this checkout supplies no package.
  Staff can record actual benefits before offline confirmation.
- Production campaign checkout requires usable matching PayPal credentials and live mode. The
  public availability lookup exposes only readiness, never credentials. Check giving remains available.
- Nine synthetic execution tests cover creation, online/check routes, confirmation, receipts,
  idempotency, refund/void exclusions and production configuration rejection. No live gift or
  receipt email is created by these tests.
- Desktop/mobile browser review checks homepage links, campaign rendering, a mocked check submission,
  overflow, browser errors and preservation of general giving. Local preview blocks writes.

Local verification passed: `verify:change`, all 38 sponsorship tests (including nine campaign tests), sponsorship and changed-file lint, production build, and the desktop/mobile walkthrough. The unauthenticated staff gifts route returned 401.

The public giving page and public lookup responded successfully. Local payment configuration is
sandbox; Vercel's production export masks the relevant values. Those reads do **not** establish live
capture readiness or the merchant recipient. Confirm these through an authorized production
configuration/processor read at release; do not use an actual charge as a test.

## Publication sequence after review

1. Accept the page, receipt language and proposed trip-change terms.
2. Verify production processor readiness and booster merchant destination without a charge.
3. Apply only the reviewed forward migration through the production Supabase wrapper; verify columns,
   default general purpose for historical gifts and unchanged RLS. Never blanket-push unrelated migrations.
4. Integrate the reviewed branch into main, run required release checks, then use `release:checked`.
5. Verify the final public alias, giving availability, nonprofit copy and affected authorization
   boundaries; perform read-only ledger reconciliation. Do not claim the campaign is live before this.

Rollback: restore the preceding application release if needed. Retain the additive columns and any
campaign gift records; never relabel received gifts to general support during rollback.
