// Carnegie supporters thanked by name on the homepage (#102).
//
// Curated by hand. A name is added only when Mr. Parker chooses it, after it is checked against a
// confirmed, received Carnegie gift record. Never generate this list from the gift table.
// Names only: no amounts, tiers, ranking, contact details or benefit promises.
// Each entry: { name, detail? }. `detail` is an optional second line, such as the person behind a business.
// Order is the order gifts were received, not size.
export const CARNEGIE_SUPPORTERS = Object.freeze([
  Object.freeze({ name: "Johnson Laser Eye", detail: "Dr. Gregory Johnson" }),
  Object.freeze({ name: "CKKB Holdings, LLC" })
]);

export const CARNEGIE_SUPPORTER_FIELDS = Object.freeze(["name", "detail"]);
