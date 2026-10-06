import { prisma } from "@/lib/prisma";

// Field agents type a brand name freely (they need to log competitor or
// not-yet-partnered brands too). This tries to link that text to a real
// Brand catalog row, case-insensitively, so client reports and category
// benchmarks can use it — without forcing agents into a dropdown.
export async function matchBrandId(brandName: string): Promise<string | null> {
  const match = await prisma.brand.findFirst({
    where: { name: { equals: brandName.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id ?? null;
}

export async function matchBrandIds(brandNames: string[]): Promise<Record<string, string | null>> {
  if (brandNames.length === 0) return {};
  const unique = Array.from(new Set(brandNames.map((b) => b.trim())));
  const brands = await prisma.brand.findMany({
    where: { OR: unique.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
    select: { id: true, name: true },
  });
  const byLowerName = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
  const result: Record<string, string | null> = {};
  for (const name of unique) {
    result[name] = byLowerName.get(name.toLowerCase()) ?? null;
  }
  return result;
}
