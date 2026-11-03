import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

  const where: Prisma.AssessmentWhereInput = {
    status: "REVIEWED",
    ...(brandIdFilter
      ? { productLines: { some: { brandId: { in: brandIdFilter } } } }
      : {}),
    ...(province && province !== "ALL"
      ? { store: { province } }
      : {}),
    ...(storeId && storeId !== "ALL" ? { storeId } : {}),
    ...(turnover === "unknown"
      ? { estimatedMonthlyTurnoverZar: null }
      : turnover === "0-20k"
        ? { estimatedMonthlyTurnoverZar: { lt: 20000 } }
        : turnover === "20k-50k"
          ? {
              estimatedMonthlyTurnoverZar: {
                gte: 20000,
                lte: 50000,
              },
            }
          : turnover === "50k+"
            ? { estimatedMonthlyTurnoverZar: { gt: 50000 } }
            : {}),
  };

  const assessments = await prisma.assessment.findMany({
    where,
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

  for (const a of assessments) {
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