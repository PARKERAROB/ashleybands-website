// #227: one-time backfill of PayPal's fee onto confirmed online Carnegie gifts, so music notes
// show what the Boosters received. Reads fees from live PayPal Transaction Search (the read-only
// reporting app, PAYPAL_REPORT_CLIENT_ID / _SECRET); writes only sponsor_gifts.paypal_fee_cents
// where it is null. Dry run unless --write.
//   node --env-file=.env.local scripts/backfill-sponsor-gift-fees.mjs [--write]
const write = process.argv.includes("--write");
const { NEXT_PUBLIC_SUPABASE_URL: db, SUPABASE_SECRET_KEY: key, PAYPAL_REPORT_CLIENT_ID: id, PAYPAL_REPORT_CLIENT_SECRET: secret } = process.env;
const API = "https://api-m.paypal.com";
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const cents = (value) => Math.round(Math.abs(Number(value)) * 100);

const tokenResponse = await fetch(`${API}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials"
});
if (!tokenResponse.ok) throw new Error(`PayPal token failed (${tokenResponse.status})`);
const { access_token: token } = await tokenResponse.json();

const gifts = await (await fetch(`${db}/rest/v1/sponsor_gifts?select=id,amount_cents,paypal_capture_id,confirmed_at,created_at&campaign_code=eq.carnegie-2027&status=eq.confirmed&method=eq.online&paypal_capture_id=not.is.null&paypal_fee_cents=is.null`, { headers })).json();
if (!Array.isArray(gifts)) throw new Error("Gift list unavailable");
if (!gifts.length) { console.log("No gifts need a fee."); process.exit(0); }

// Transaction Search allows 31 days per request.
const fees = new Map();
const first = new Date(Math.min(...gifts.map((g) => Date.parse(g.created_at)))) - 86400000;
for (let start = first; start < Date.now(); start += 30 * 86400000) {
  const end = Math.min(start + 30 * 86400000, Date.now());
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ start_date: new Date(start).toISOString().replace(/\.\d+Z$/, "Z"), end_date: new Date(end).toISOString().replace(/\.\d+Z$/, "Z"), fields: "transaction_info", page_size: "500", page: String(page) });
    const response = await fetch(`${API}/v1/reporting/transactions?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Transaction search failed (${response.status})`);
    const body = await response.json();
    for (const { transaction_info: info } of body.transaction_details || []) {
      if (info?.transaction_amount?.currency_code !== "USD") continue;
      fees.set(info.transaction_id, { gross: cents(info.transaction_amount.value), fee: info.fee_amount ? cents(info.fee_amount.value) : 0 });
    }
    if (page >= (body.total_pages || 1)) break;
  }
}

let done = 0, feeTotal = 0;
const missing = [];
for (const gift of gifts) {
  const found = fees.get(gift.paypal_capture_id);
  if (!found) { missing.push(gift.id); continue; }
  if (found.gross !== gift.amount_cents || found.fee > found.gross) throw new Error(`Transaction does not reconcile for gift ${gift.id}`);
  feeTotal += found.fee; done++;
  if (write) {
    const update = await fetch(`${db}/rest/v1/sponsor_gifts?id=eq.${gift.id}&paypal_fee_cents=is.null`, { method: "PATCH", headers, body: JSON.stringify({ paypal_fee_cents: found.fee }) });
    if (!update.ok) throw new Error(`Write failed for gift ${gift.id} (${update.status})`);
  }
}
console.log(`${write ? "Wrote" : "Would write"} fees on ${done} of ${gifts.length} gifts, $${(feeTotal / 100).toFixed(2)} in all.`);
if (missing.length) console.log(`Not in PayPal's search yet (it lags up to 3 hours); rerun later: ${missing.length} gift(s).`);
