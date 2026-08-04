import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// "Proud Sponsor of the Bands of Ashley" badge (build-spec §6 Lane A.3). A self-contained
// SVG — no image deps — that a sponsor can post on their storefront/socials. The sponsor
// self-markets the program for free. Linked from the auto receipt.
//
// A badge is issued only for a confirmed gift that staff approved for public recognition.
function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Fit a long business name by stepping the font size down.
function nameFontSize(name) {
  const len = String(name || "").length;
  if (len <= 14) return 46;
  if (len <= 22) return 36;
  if (len <= 32) return 28;
  return 22;
}

export async function GET(req) {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { data: gift } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("business_name, confirmed_at")
    .eq("id", id)
    .eq("status", "confirmed")
    .eq("listed_on_site", true)
    .maybeSingle();
  if (!gift?.business_name) return new Response("Not found", { status: 404 });
  const name = gift.business_name.trim();
  const year = String(new Date(gift.confirmed_at || Date.now()).getFullYear());

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="Proud Sponsor of the Bands of Ashley — ${esc(name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f2a1a"/>
      <stop offset="1" stop-color="#163a24"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect x="40" y="40" width="920" height="920" rx="28" fill="none" stroke="#d8b46a" stroke-width="6"/>
  <rect x="64" y="64" width="872" height="872" rx="18" fill="none" stroke="#d8b46a" stroke-width="2" opacity="0.6"/>
  <text x="500" y="240" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" letter-spacing="6" fill="#d8b46a">PROUD SPONSOR OF</text>
  <text x="500" y="330" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="74" font-weight="bold" fill="#ffffff">THE BANDS</text>
  <text x="500" y="412" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="74" font-weight="bold" fill="#ffffff">OF ASHLEY</text>
  <line x1="320" y1="500" x2="680" y2="500" stroke="#d8b46a" stroke-width="2"/>
  <text x="500" y="620" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameFontSize(name)}" font-weight="bold" fill="#d8b46a">${esc(name)}</text>
  <text x="500" y="780" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" letter-spacing="3" fill="#ffffff" opacity="0.85">SCREAMING EAGLE REGIMENT</text>
  <text x="500" y="838" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" letter-spacing="2" fill="#d8b46a">${esc(year)}</text>
  <text x="500" y="900" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="#ffffff" opacity="0.6">ashleybands.com/sponsors</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
