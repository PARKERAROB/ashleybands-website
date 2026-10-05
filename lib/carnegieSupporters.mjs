// Carnegie supporters thanked by name on the homepage (#102).
//
// Curated by hand. Every business with a confirmed, received Carnegie gift is always added (Rob,
// 2026-10-01, #161). Individual donors are added only when Mr. Parker chooses. Check each name
// against the gift record first. Never generate this list from the gift table.
// Names only: no amounts, tiers, ranking, contact details or benefit promises.
// Each entry: { name, detail? }. `detail` is an optional second line, such as the person behind a business.
// Order is the order gifts were received, not size.
export const CARNEGIE_SUPPORTERS = Object.freeze([
  Object.freeze({ name: "Johnson Laser Eye", detail: "Dr. Gregory Johnson" }),
  Object.freeze({ name: "CKKB Holdings, LLC" }),
  Object.freeze({ name: "Michaelangelo’s Pizza" }),
  Object.freeze({ name: "Beach Bagels & Subs" }),
  Object.freeze({ name: "Island Blue Properties" })
]);

export const CARNEGIE_SUPPORTER_FIELDS = Object.freeze(["name", "detail"]);

// Sponsor logos (#175). Curated by hand: add a business only after it sends a print-ready logo for
// recognition use. Keyed by business name; matched case-insensitively against the homepage list and
// the /sponsors listing. Businesses without an entry stay name-only.
const SPONSOR_LOGOS = Object.freeze({
  "beach bagels & subs": Object.freeze({ src: "/sponsors/logos/beach-bagels-and-subs.png", width: 600, height: 394 })
});

const logoKey = (name) => String(name || "").trim().replace(/\s+/g, " ").replace(/[‘’]/g, "'").toLowerCase();

export function sponsorLogo(name) {
  return SPONSOR_LOGOS[logoKey(name)] || null;
}
