import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { privateJson } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Public holiday raffle prize offer (#212). Capture only: one private row per offer in
// raffle_prize_offers. Nothing is shown publicly and no email is sent. Fails closed on a
// limiter outage so a public write path can never become unlimited.

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request) {
  const network = await checkRateLimit({ key: `raffle-offer:${clientIp(request)}`, limit: 8, windowMs: 10 * 60 * 1000, failOpen: false });
  if (!network.allowed) return privateJson({ error: "Too many offers from this network. Please try again in a little while." }, 429);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid request." }, 400);
  // Honeypot: people never see this field. Answer as if saved so bots learn nothing.
  if (clean(body.website, 200)) return privateJson({ ok: true });

  const offer = {
    donor_name: clean(body.donor_name, 200),
    business_name: clean(body.business_name, 200),
    contact: clean(body.contact, 200),
    prize_description: clean(body.prize_description, 2000),
    estimated_value: clean(body.estimated_value, 50),
  };
  if (!offer.donor_name || !offer.contact || !offer.prize_description || !offer.estimated_value) {
    return privateJson({ error: "Please fill in every required field." }, 400);
  }
  if (offer.contact.length < 3) return privateJson({ error: "Please enter an email or phone number we can reach you at." }, 400);

  const { error } = await supabaseAdmin.from("raffle_prize_offers").insert(offer);
  if (error) {
    console.error("[raffle-offer]", error.message);
    return privateJson({ error: "We could not save your offer. Please try again or email Mr. Parker." }, 500);
  }
  return privateJson({ ok: true });
}
