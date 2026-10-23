import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STANDARD_CATEGORIES } from "@/lib/productCatalog";

/** Brand + category suggestions for field capture dropdowns. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The brand catalog reveals which companies are Real Makoya clients, so FMCG
  // logins must never be able to read it. Only field capture needs it.
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalogBrands = await prisma.brand.findMany({
    select: { name: true, category: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  // Distinct brands/categories already typed in the field (helps non-partner brands)
  const fromLines = await prisma.productLine.findMany({
    select: { brand: true, category: true },
    distinct: ["brand"],
    take: 300,
    orderBy: { brand: "asc" },
  });

  const brandMap = new Map<string, string | null>();
  for (const b of catalogBrands) {
    brandMap.set(b.name, b.category);
  }
  for (const row of fromLines) {
    if (!brandMap.has(row.brand)) brandMap.set(row.brand, row.category);
  }

  const brands = Array.from(brandMap.entries())
    .map(([name, category]) => ({ name, category }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categorySet = new Set<string>([...STANDARD_CATEGORIES]);
  for (const b of brands) {
    if (b.category) categorySet.add(b.category);
  }
  const categories = Array.from(categorySet).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  return NextResponse.json({ brands, categories });
}
