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
  } catch {
    // Never substitute gross receipts, a partial sum, or provider error details.
    return null;
  }
}, ["carnegie-net-funding-v1"], { revalidate: 60 });
