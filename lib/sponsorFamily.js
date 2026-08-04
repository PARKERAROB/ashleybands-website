import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPin, readFamilySession } from "@/lib/sponsorAuth";
import { readPortalSession } from "@/lib/portalTokens";
import { legacySponsorPinEnabled } from "@/lib/sponsorGiftPolicy.mjs";

// Sponsorship-family resolver: the Family Portal is the production identity boundary.
//
// Two ways a family can be "in":
//   1. Portal session  — every band family already has a Family Portal identity. The first
//      time a logged-in guardian opens the sponsorship section, we find-or-create a single
//      `families` row bound to their portal person id. This is how 8 families becomes 161.
//   2. Legacy PIN cookie/headers — retained only behind an explicit emergency flag. It is
//      closed by default and is not part of the production family path.
//
// Both paths return the same { family, actor } shape so every downstream route is identical.

// ---- Feature flags (DARK by default) -------------------------------------------------
// The whole funnel stays invisible/closed until SPONSOR_FUNNEL_LIVE === "true". Recognition
// auto-sends (receipt / badge emails) stay off until SPONSOR_RECOGNITION_LIVE === "true",
// so each transactional template fires only after Rob has approved it once (L2 posture,
// same as the portal payment receipt and the forgo-refund flag).
export function sponsorFunnelLive() {
  return String(process.env.SPONSOR_FUNNEL_LIVE || "").toLowerCase() === "true";
}

export function sponsorRecognitionLive() {
  return String(process.env.SPONSOR_RECOGNITION_LIVE || "").toLowerCase() === "true";
}

export function sponsorLegacyPinLive() {
  return sponsorFunnelLive() && legacySponsorPinEnabled(process.env.SPONSOR_LEGACY_PIN_LIVE);
}

// Online sponsor-pay (PayPal) is additionally gated: it needs live PayPal credentials AND
// the funnel flag. Check instructions are always available (no processor needed).
export function sponsorOnlineGiveLive() {
  return sponsorFunnelLive() && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// ---- Portal-family bridge ------------------------------------------------------------

async function loadFamilyById(id) {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("families")
    .select("id, display_name, session_token, portal_person_id, source")
    .eq("id", id)
    .maybeSingle();
  return data || null;
}

// Find-or-create the single sponsorship family row bound to a portal person.
async function findOrCreatePortalFamily(personId) {
  const { data: existing } = await supabaseAdmin
    .from("families")
    .select("id, display_name, session_token, portal_person_id, source")
    .eq("portal_person_id", personId)
    .maybeSingle();
  if (existing) return existing;

  // Build a display name from the portal person, with a household student attached when we
  // can find one (purely for staff legibility on the master view).
  const { data: person } = await supabaseAdmin
    .from("portal_people")
    .select("id, display_name")
    .eq("id", personId)
    .maybeSingle();
  const baseName = (person?.display_name || "Band Family").trim();

  const { data: link } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id")
    .eq("person_id", personId)
    .eq("relationship_status", "trusted")
    .limit(1)
    .maybeSingle();
  const studentId = link?.student_id || null;

  // display_name is UNIQUE on families. A legacy PIN family may already hold this name, so
  // fall back to a disambiguated name rather than colliding.
  const candidates = [baseName, `${baseName} (portal)`, `${baseName} ${personId.slice(0, 6)}`];
  for (const name of candidates) {
    const insert = {
      display_name: name,
      pin_hash: hashPin(crypto.randomBytes(16).toString("hex")), // never used; portal entry uses the portal session
      portal_person_id: personId,
      portal_student_id: studentId,
      source: "portal"
    };
    const { data, error } = await supabaseAdmin
      .from("families")
      .insert(insert)
      .select("id, display_name, session_token, portal_person_id, source")
      .single();
    if (!error && data) return data;
    // 23505 = unique_violation on display_name; try the next candidate. If it was the
    // portal_person unique index, another request created it first — re-read and return.
    const reread = await supabaseAdmin
      .from("families")
      .select("id, display_name, session_token, portal_person_id, source")
      .eq("portal_person_id", personId)
      .maybeSingle();
    if (reread.data) return reread.data;
  }
  return null;
}

// Resolve the acting sponsorship family from a request. Portal session wins; PIN cookie is
// the fallback. Returns { family, actor: 'portal' | 'pin' } or null.
export async function resolveSponsorFamily(req) {
  const portal = readPortalSession(req);
  if (portal?.personId) {
    const family = await findOrCreatePortalFamily(portal.personId);
    if (family) return { family, actor: "portal" };
  }

  if (sponsorLegacyPinLive()) {
    const { familyId, token } = readFamilySession(req);
    if (familyId && token) {
      const family = await loadFamilyById(familyId);
      if (family && family.session_token === token) {
        return { family, actor: "pin" };
      }
    }
  }

  return null;
}
