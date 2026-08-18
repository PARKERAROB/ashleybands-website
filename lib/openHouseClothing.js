export const CLOTHING_DEADLINE = "2026-08-28T23:59:59-04:00";
export const CLOTHING_TAX_RATE = 0.07;

export const OPEN_HOUSE_CLOTHING = [
  {
    id: "regiment-shirt",
    name: "Official Red Band Shirt",
    description: "Required for every band student. Worn for pep rallies, community performances, parades, and informal band events.",
    required: true,
    priceCents: 1999,
    colors: ["Maroon"],
    sizes: ["XS","S","M","L","XL","2XL","3XL","4XL","5XL"]
  },
  { id: "ascend-shirt", name: "Ascend — 2026 MB Show Shirt", priceCents: 1999, colors: ["Navy"], sizes: ["S","M","L","XL","2XL","3XL","4XL","5XL"] },
  { id: "ascend-hoodie", name: "Ascend — 2026 MB Show Hoodie", priceCents: 3999, colors: ["Navy"], sizes: ["S","M","L","XL","2XL","3XL","4XL","5XL"] },
  { id: "regiment-shirt-other-colors", name: "Screaming Eagle Regiment Logo T-Shirt — Optional Colors", priceCents: 1999, colors: ["White","Black","Sport Grey","Dark Heather","Navy","Purple","Light Pink"], sizes: ["XS","S","M","L","XL","2XL","3XL","4XL","5XL"] },
  { id: "regiment-hoodie", name: "Screaming Eagle Regiment Logo Hoodie", priceCents: 3999, colors: ["Black","Sport Grey","Maroon","Navy","Purple","Light Pink"], sizes: ["S","M","L","XL","2XL","3XL","4XL","5XL"] },
  { id: "band-jacket", name: "Bands of AHS Jacket", priceCents: 5999, colors: ["Deep Black"], sizes: ["S","M","L","XL","2XL","3XL","4XL"] },
  { id: "band-polo", name: "Bands of AHS Polo", priceCents: 3999, colors: ["Iron Grey","Black","True Navy","Purple","Maroon"], sizes: ["XS","S","M","L","XL","2XL","3XL","4XL"] }
];

export function clothingTotals(lines) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const taxCents = Math.round(subtotalCents * CLOTHING_TAX_RATE);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
