import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shapeReported } from "@/lib/carnegieTripAccount";

// Adults coming to New York for Carnegie Hall 2027 (#237). Rob's rulings, 2026-10-27:
// - with the band: $2,500 a person in a double; $2,000 in a quad only when all four beds fill
//   (otherwise it becomes a double at $2,500);
// - getting there on their own is the default; Rob alone marks an official, on-the-bus chaperone;
// - pay in any amounts; every payment is non-refundable; paid in full by Nov 23 preferred,
//   final cutoff Thursday, Dec 10; Rob signs off before unused payments move to the general fund.
export const CARNEGIE_ADULT_CATEGORY = "carnegie_2027_adult";
export const CARNEGIE_ADULT_TERMS_VERSION = "2026-10-27-v1";
export const CARNEGIE_ADULT_PREFERRED_DUE = "2026-11-23";
export const CARNEGIE_ADULT_CUTOFF = "2026-12-10";

export function carnegieAdultPriceCents(travelOption, roomType) {
  if (travelOption !== "with_band") return 0;
  return roomType === "quad" ? 200000 : 250000;
}

const ADULT_FIELDS = "id,student_id,adult_name,travel_option,room_type,roommates,chaperone_interest,official_chaperone,price_cents,status,created_at";

function shapeAdult(row) {
  return {
    id: row.id,
    name: row.adult_name,
    travelOption: row.travel_option,
    roomType: row.room_type,
    roommates: row.roommates,
    chaperoneInterest: row.chaperone_interest,
    officialChaperone: row.official_chaperone,
    priceCents: Number(row.price_cents) || 0,
    createdAt: row.created_at,
  };
}

// { [studentId]: { adults, totalCents, paidCents, owedCents, payments } }, or null on a read error.
export async function loadCarnegieAdultAccounts(studentIds) {
  if (!studentIds.length) return {};
  const [adults, payments, reported] = await Promise.all([
    supabaseAdmin.from("carnegie_adult_travelers").select(ADULT_FIELDS)
      .in("student_id", studentIds).eq("status", "active").order("created_at"),
    supabaseAdmin.from("fee_payments").select("id,student_id,amount_cents,paypal_fee_cents,method,received_at,created_at")
      .in("student_id", studentIds).eq("category", CARNEGIE_ADULT_CATEGORY).eq("kind", "fee").eq("status", "completed"),
    supabaseAdmin.from("fee_payments").select("id,student_id,amount_cents,method,check_number,created_at")
      .in("student_id", studentIds).eq("category", CARNEGIE_ADULT_CATEGORY)
      .eq("status", "pending").like("recorded_by", "family:%"),
  ]);
  if (adults.error || payments.error || reported.error) return null;
  const accounts = {};
  for (const studentId of studentIds) {
    const list = (adults.data || []).filter((row) => row.student_id === studentId).map(shapeAdult);
    const paid = (payments.data || []).filter((row) => row.student_id === studentId).map((row) => ({
      id: row.id,
      // Credit what reached the Boosters, after PayPal's fee (Rob, 2026-10-27).
      amountCents: (Number(row.amount_cents) || 0) - (Number(row.paypal_fee_cents) || 0),
      grossCents: Number(row.amount_cents) || 0,
      paypalFeeCents: row.paypal_fee_cents == null ? null : Number(row.paypal_fee_cents),
      method: row.method,
      receivedAt: row.received_at || row.created_at,
    }));
    if (!list.length && !paid.length) continue;
    const totalCents = list.reduce((sum, adult) => sum + adult.priceCents, 0);
    const paidCents = paid.reduce((sum, row) => sum + row.amountCents, 0);
    accounts[studentId] = {
      adults: list,
      payments: paid,
      totalCents,
      paidCents,
      owedCents: Math.max(totalCents - paidCents, 0),
      reported: (reported.data || []).filter((row) => row.student_id === studentId).map(shapeReported),
      preferredDue: CARNEGIE_ADULT_PREFERRED_DUE,
      cutoff: CARNEGIE_ADULT_CUTOFF,
    };
  }
  return accounts;
}

export async function carnegieAdultRemainingCents(studentId) {
  const accounts = await loadCarnegieAdultAccounts([studentId]);
  if (!accounts) return null;
  return accounts[studentId]?.owedCents ?? 0;
}

export function validateCarnegieAdult(input) {
  const adultName = String(input.adultName || "").trim().slice(0, 120);
  const travelOption = String(input.travelOption || "");
  const roomType = travelOption === "with_band" ? String(input.roomType || "") : null;
  if (!adultName) return { error: "Enter the adult's name." };
  if (!["with_band", "own_way"].includes(travelOption)) return { error: "Choose how this adult is coming." };
  if (travelOption === "with_band" && !["double", "quad"].includes(roomType)) return { error: "Choose a room." };
  if (travelOption === "with_band" && input.termsAccepted !== true) {
    return { error: "Read and accept the payment terms." };
  }
  return {
    adultName,
    travelOption,
    roomType,
    roommates: String(input.roommates || "").trim().slice(0, 300),
    chaperoneInterest: travelOption === "with_band" && input.chaperoneInterest === true,
    termsAccepted: travelOption === "with_band",
  };
}
