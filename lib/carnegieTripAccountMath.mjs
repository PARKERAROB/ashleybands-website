// Carnegie 2027 student trip account (#237). Rob's rulings, 2026-10-27:
// - each trip student's share is $2,000, fixed; group credits are applied to everyone later;
// - gifts given for a named student count toward that student, including toward the first payment;
// - general (whole-trip) gifts never lower one student's share;
// - first payment is $650, the $50 deposit included, due October 30, 2026;
// - families may pay any amount; each payment lowers what is still owed.
// Pure math only, so it can be tested without the database.

export const CARNEGIE_TRIP_CATEGORY = "carnegie_2027_trip";
export const CARNEGIE_DEPOSIT_CATEGORY = "carnegie_2027_conditional_deposit";
export const CARNEGIE_SHARE_CENTS = 200000;
export const CARNEGIE_FIRST_PAYMENT_CENTS = 65000;
export const CARNEGIE_FIRST_PAYMENT_DUE = "2026-10-30";

// Website credits that stay on the site but don't count for the student yet (Rob, 2026-10-27).
// Mirrors NOT_YET in Atlas/tools/carnegie-student-money/build.py.
export const CARNEGIE_NOT_YET_FOR_STUDENT = new Set(["AB-SP-ADF984C6FA7BAB491349"]);

// PayPal's usual rate on the band's captures: 2.99% + $0.49 ($100 -> $3.48). Some cards cost more (one $25 gift paid $1.36),
// so this is an estimate; the real fee is recorded at capture and only the net is credited.
// Families may cover it (Rob, 2026-10-27); only what reaches the Boosters is credited.
export function paypalFeeCents(grossCents) {
  return Math.round(grossCents * 0.0299 + 49);
}
export function paypalGrossUpCents(netCents) {
  if (!netCents) return 0;
  let gross = Math.ceil((netCents + 49) / (1 - 0.0299));
  while (gross - paypalFeeCents(gross) < netCents) gross += 1;
  return gross;
}

export function carnegieTripAccount({ gifts = [], familyPayments = [] }) {
  const counted = gifts.filter((gift) => !CARNEGIE_NOT_YET_FOR_STUDENT.has(gift.invoiceId));
  const giftCents = counted.reduce((total, gift) => total + (Number(gift.amountCents) || 0), 0);
  const familyCents = familyPayments.reduce((total, payment) => total + (Number(payment.amountCents) || 0), 0);
  // Anything above the share goes to the whole fund, family money included (Rob, 2026-10-27).
  const creditedCents = Math.min(giftCents + familyCents, CARNEGIE_SHARE_CENTS);
  return {
    shareCents: CARNEGIE_SHARE_CENTS,
    giftCents,
    familyCents,
    creditedCents,
    owedCents: CARNEGIE_SHARE_CENTS - creditedCents,
    firstPaymentCents: CARNEGIE_FIRST_PAYMENT_CENTS,
    firstPaymentDue: CARNEGIE_FIRST_PAYMENT_DUE,
    firstPaymentOwedCents: Math.max(CARNEGIE_FIRST_PAYMENT_CENTS - creditedCents, 0),
    gifts: counted,
    familyPayments,
  };
}
