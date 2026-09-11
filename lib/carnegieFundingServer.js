import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPaypalFundingReader } from "@/lib/paypal";
import { allFundingRows, reconcileCarnegieFunding } from "@/lib/carnegieFunding.mjs";

// Aggregate-only cache. Existing app does not enable Next Cache Components.
export const getCarnegieFunding = unstable_cache(async () => {
  try {
    const fields = "id,amount_cents,status,method,invoice_id,paypal_capture_id,paypal_order_id,received_at";
    const [payments, gifts] = await Promise.all([
      allFundingRows((start, end) => supabaseAdmin.from("fee_payments")
        .select(`${fields},category,kind`).like("category", "carnegie_2027%")
        .in("status", ["completed", "refunded"]).order("id").range(start, end)),
      allFundingRows((start, end) => supabaseAdmin.from("sponsor_gifts")
        .select(`${fields},campaign_code`).eq("campaign_code", "carnegie-2027")
        .in("status", ["confirmed", "refunded"]).order("id").range(start, end))
    ]);
    return await reconcileCarnegieFunding(payments, gifts, createPaypalFundingReader());
  } catch (error) {
    const safeReasons = new Set([
      "Funding ledger unavailable", "Live PayPal required for public funding",
      "Processor reconciliation unavailable", "Capture identity mismatch", "Unsettled capture",
      "Unverified USD amount", "Capture costs need reconciliation", "Refund costs need reconciliation",
      "Incomplete refund evidence", "Refund status mismatch", "Missing or duplicate capture",
      "Receipt date missing", "Payment costs need reconciliation", "Ambiguous refund allocation"
    ]);
    console.error("Carnegie funding unavailable:", safeReasons.has(error?.message) ? error.message : "Processor or accounting verification failed");
    // Never substitute gross receipts, a partial sum, or provider error details.
    return null;
  }
}, ["carnegie-net-funding-v1"], { revalidate: 60 });
