import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function matchesTurnover(value: number | null | undefined, band: string | null): boolean {
  if (!band || band === "ALL") return true;
  if (band === "unknown") return value == null;
  if (value == null) return false;
  if (band === "0-20k") return value < 20000;
  if (band === "20k-50k") return value >= 20000 && value <= 50000;
  if (band === "50k+") return value > 50000;
  return true;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isClient = session.user.role === "CLIENT";
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("brand");
  const province = sp.get("province");
  const storeId = sp.get("storeId");
  const turnover = sp.get("turnover");

  let brandIdFilter: string[] | null = null;

  if (isClient) {
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { include: { brands: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "No organization membership" }, { status: 403 });
    }
    const accessible = membership.allBrandsAccess
      ? membership.organization.brands.map((b) => b.id)
      : membership.brandIds;
    brandIdFilter =
      brand && accessible.includes(brand) ? [brand] : accessible;
  }

  const assessments = await prisma.assessment.findMany({
    where: isClient ? { status: "REVIEWED" } : undefined,
    include: {
      store: {
        select: { id: true, name: true, town: true, province: true },
      },
      productLines: brandIdFilter
        ? { where: { brandId: { in: brandIdFilter } } }
        : true,
    },
    orderBy: { visitDate: "desc" },
  });

  let scoped = brandIdFilter
    ? assessments.filter((a) => a.productLines.length > 0)
    : assessments;

  if (province && province !== "ALL") {
    scoped = scoped.filter((a) => a.store.province === province);
  }
  if (storeId && storeId !== "ALL") {
    scoped = scoped.filter((a) => a.storeId === storeId);
  }
  if (turnover && turnover !== "ALL") {
    scoped = scoped.filter((a) =>
      matchesTurnover(a.estimatedMonthlyTurnoverZar, turnover)
    );
  }

  const includeNotes = !isClient;
  const headers = [
    "Store",
    "Town",
    "Province",
    "VisitDate",
    "Brand",
    "Category",
    "Rank",
    "UnitsPerMonth",
    "UnitPriceZar",
    "LineValueZar",
  ];
  if (includeNotes) headers.push("Notes");

  const lines = [headers.join(",")];

  for (const a of scoped) {
    for (const p of a.productLines) {
      const units = p.estimatedMonthlyUnits;
      const price = p.estimatedUnitPriceZar;
      const line =
        units != null && price != null ? Math.round(units * price) : "";
      const row = [
        csvEscape(a.store.name),
        csvEscape(a.store.town),
        csvEscape(a.store.province),
        csvEscape(new Date(a.visitDate).toISOString().slice(0, 10)),
        csvEscape(p.brand),
        csvEscape(p.category),
        csvEscape(p.rank),
        csvEscape(units),
        csvEscape(price),
        csvEscape(line),
      ];
      if (includeNotes) row.push(csvEscape(p.notes));
      lines.push(row.join(","));
    }
  }

  const body = lines.join("\r\n");
  const filename = `real-makoya-products-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
