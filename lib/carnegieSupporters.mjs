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

// Marching band business sponsors thanked on /sponsors (#185). Mirrors the boosters money sheet's
// Sponsors tab, the source of truth for sponsors (Rob, 2026-10-07): businesses only, fund =
// Marching, money received. Individual donors and pledges not yet received stay off.
// Order is the order gifts were received, not size. Names only.
export const MARCHING_SPONSORS = Object.freeze([
  Object.freeze({ name: "Jeff Rifkin Photography" }),
  Object.freeze({ name: "Cavik Insurance" }),
  Object.freeze({ name: "Pon Winstead", detail: "Coldwell Banker Sea Coast Advantage" }),
  Object.freeze({ name: "Kate’s Pancake House" }),
  Object.freeze({ name: "Sheetz" }),
  Object.freeze({ name: "Joe’s Oasis" }),
  Object.freeze({ name: "Tip Top Frame" }),
  Object.freeze({ name: "Hooks & Arrows Sportsmanship Supply" }),
  Object.freeze({ name: "Seaside Bagels" }),
  Object.freeze({ name: "Association for Learning Environments" }),
  Object.freeze({ name: "Riccobene Central Services" }),
  Object.freeze({ name: "Kilwins Pointe at Barclay" }),
  Object.freeze({ name: "Seay Law Firm" }),
  Object.freeze({ name: "Hot Wax Surf Shop" }),
  Object.freeze({ name: "El Cerro Grande" }),
  Object.freeze({ name: "Planet Smoothie" }),
  Object.freeze({ name: "BlueCoast Realty" })
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
