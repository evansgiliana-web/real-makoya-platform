/** Common FMCG categories for spaza capture — keep short for field speed. */
export const STANDARD_CATEGORIES = [
  "Beverages",
  "Snacks",
  "Bakery",
  "Dairy",
  "Frozen",
  "Food / Grocery",
  "Laundry",
  "Household Cleaning",
  "Personal Care",
  "Baby Care",
  "Tobacco",
  "Airtime / Data",
  "Other",
] as const;

export type LineForRank = {
  estimatedMonthlyUnits: string;
  estimatedUnitPriceZar: string;
};

/** Line sale value for ranking; falls back to units if price missing. */
export function lineSaleValue(line: LineForRank): number {
  const units = parseFloat(line.estimatedMonthlyUnits);
  const price = parseFloat(line.estimatedUnitPriceZar);
  const u = Number.isFinite(units) ? units : 0;
  const p = Number.isFinite(price) ? price : 0;
  if (u > 0 && p > 0) return u * p;
  if (u > 0) return u; // units-only ranking when price unknown
  return 0;
}

/**
 * Assign ranks 1..n by descending sale value.
 * Rank 1 = highest estimated monthly sale value.
 * Lines with zero value get no rank (empty string).
 */
export function autoRankLines<T extends LineForRank>(
  lines: T[]
): (T & { rank: string })[] {
  const scored = lines.map((line, index) => ({
    index,
    value: lineSaleValue(line),
  }));
  const ranked = [...scored].sort((a, b) => b.value - a.value);
  const rankByIndex = new Map<number, string>();
  let rank = 1;
  for (const item of ranked) {
    if (item.value <= 0) {
      rankByIndex.set(item.index, "");
      continue;
    }
    rankByIndex.set(item.index, String(rank));
    rank += 1;
  }
  return lines.map((line, i) => ({
    ...line,
    rank: rankByIndex.get(i) ?? "",
  }));
}
