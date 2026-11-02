export const CARNEGIE_FUNDING_GOAL_CENTS = 25000000;
// The tracker measures against the next goal, not the full-trip estimate (Rob, 2026-10-28, #240).
// First goal $25,000 met Oct 2026. Next goal $70,000, no date (Rob, 2026-11-02, #254).
export const CARNEGIE_NEXT_GOAL_CENTS = 7000000;

// Strict USD parsing: missing fees must never silently become zero.
export function usdCents(money) {
  if (money?.currency_code !== "USD" || !/^\d+\.\d{2}$/.test(money?.value || "")) {
    throw new Error("Unverified USD amount");
  }
  const cents = Number(money.value.replace(".", ""));
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid amount");
  return cents;
}

export async function allFundingRows(queryPage) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await queryPage(start, start + 499);
    if (error || !Array.isArray(data)) throw new Error("Funding ledger unavailable");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

// A staff split keeps the capture on the original row. Each added row has a blank capture and
// the original's invoice plus a letter (-D), so together they must equal the one PayPal capture.
const isSplitRow = row => !row.paypal_capture_id && /-[A-Z]$/.test(row.invoice_id || "");

// Only received money belongs here. Credits/adjustments are not additional receipts.
export async function reconcileCarnegieFunding(payments, gifts, reader) {
  const received = [
    ...payments.filter(p => /^carnegie_2027(?:_|$)/.test(p.category) && p.kind === "fee"
      && ["completed", "refunded"].includes(p.status)
      && ["paypal", "cash", "check"].includes(p.method)),
    ...gifts.filter(g => g.campaign_code === "carnegie-2027" && ["confirmed", "refunded"].includes(g.status))
  ];
  const onlineSplit = row => row.method !== "cash" && row.method !== "check" && isSplitRow(row);
  const rows = received.filter(row => !onlineSplit(row));
  const splitCents = new Map();
  for (const split of received.filter(onlineSplit)) {
    if (!Number.isSafeInteger(split.amount_cents) || split.amount_cents <= 0) throw new Error("Invalid ledger amount");
    const original = rows.find(row => row.paypal_capture_id && row.invoice_id === split.invoice_id.slice(0, -2));
    if (!original) throw new Error("Missing or duplicate capture");
    if (split.status !== original.status) throw new Error("Refund status mismatch");
    splitCents.set(original, (splitCents.get(original) || 0) + split.amount_cents);
  }
  const seen = new Set();
  let netCents = 0;
  // Bound processor concurrency and avoid one OAuth request per payment.
  let position = 0;
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, async () => {
    while (position < rows.length) {
      const row = rows[position++];
      if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) throw new Error("Invalid ledger amount");
      if (["cash", "check"].includes(row.method)) {
        if (!row.received_at) throw new Error("Receipt date missing");
        if (row.status !== "refunded") netCents += row.amount_cents;
        continue;
      }
      if (!["online", "paypal"].includes(row.method)) throw new Error("Payment costs need reconciliation");
      const id = row.paypal_capture_id;
      if (!id || seen.has(id)) throw new Error("Missing or duplicate capture");
      seen.add(id);
      const capture = await reader.capture(id);
      const capturedCents = row.amount_cents + (splitCents.get(row) || 0);
      if (capture.id !== id || capture.invoice_id !== row.invoice_id
        || usdCents(capture.amount) !== capturedCents) throw new Error("Capture identity mismatch");
      if (!["COMPLETED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(capture.status)) throw new Error("Unsettled capture");
      const breakdown = capture.seller_receivable_breakdown;
      const gross = usdCents(breakdown?.gross_amount);
      const fee = usdCents(breakdown?.paypal_fee);
      const net = usdCents(breakdown?.net_amount);
      if (gross !== capturedCents || gross - fee !== net) throw new Error("Capture costs need reconciliation");
      let refundNet = 0;
      if (capture.status !== "COMPLETED") {
        const refunds = await reader.refunds(row.paypal_order_id, id);
        const refundIds = new Set();
        let refundGross = 0;
        for (const refund of refunds) {
          if (!refund.id || refundIds.has(refund.id) || refund.status !== "COMPLETED") throw new Error("Unsettled refund");
          refundIds.add(refund.id);
          const parts = refund.seller_payable_breakdown;
          const grossRefund = usdCents(parts?.gross_amount);
          const returnedFee = usdCents(parts?.paypal_fee);
          const debit = usdCents(parts?.net_amount);
          if (usdCents(refund.amount) !== grossRefund || grossRefund - returnedFee !== debit) throw new Error("Refund costs need reconciliation");
          refundGross += grossRefund;
          refundNet += debit;
        }
        if (!refundGross || refundGross > gross
          || (capture.status === "REFUNDED" && refundGross !== gross)
          || (capture.status === "PARTIALLY_REFUNDED" && refundGross >= gross)) throw new Error("Incomplete refund evidence");
      } else if (row.status === "refunded") throw new Error("Refund status mismatch");
      netCents += net - refundNet;
    }
  }));
  if (!Number.isSafeInteger(netCents)) throw new Error("Invalid funding total");
  // This is the entire public contract. Never return rows, names or transaction IDs.
  return {
    netCents,
    goalCents: CARNEGIE_FUNDING_GOAL_CENTS,
    milestoneCents: CARNEGIE_NEXT_GOAL_CENTS,
    checkedAt: new Date().toISOString()
  };
}
