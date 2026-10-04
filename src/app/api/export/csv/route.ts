import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "export:raw-data")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessments = await prisma.assessment.findMany({
    include: {
      store: true,
      agent: { select: { name: true, email: true } },
      productLines: true,
    },
    orderBy: { visitDate: "desc" },
  });

  const headers = [
    "Visit Date",
    "Store Name",
    "Town",
    "Province",
    "Owner Name",
    "Owner Contact",
    "Municipal Registration Status",
    "Registration Number",
    "Field Agent",
    "Total SKUs",
    "Est. Monthly Turnover (ZAR)",
    "Top Product Lines (category:brand:rank:est.units:avg price ZAR)",
    "Source Type",
    "Supplier Name",
    "Supplier Location",
    "Has Valid CoA",
    "Has Health Permit",
    "Health Permit Number",
    "Brand Authenticity Verified",
    "Counterfeit Risk",
    "Packaging Issue",
    "Batch Code Issue",
    "Pricing Anomaly",
    "Counterfeit Notes",
    "Status",
  ];

  const rows = assessments.map((a) => [
    a.visitDate.toISOString().slice(0, 10),
    a.store.name,
    a.store.town,
    a.store.province,
    a.store.ownerName,
    a.store.ownerContactNumber ?? "",
    a.store.municipalRegistrationStatus,
    a.store.municipalRegistrationNumber ?? "",
    a.agent.name,
    a.totalSkuCount ?? "",
    a.estimatedMonthlyTurnoverZar ?? "",
    a.productLines
      .map(
        (p) =>
          `${p.category}:${p.brand}:${p.rank ?? ""}:${p.estimatedMonthlyUnits ?? ""}:${p.estimatedUnitPriceZar ?? ""}`
      )
      .join(" | "),
    a.sourceType,
    a.supplierName ?? "",
    a.supplierLocation ?? "",
    a.hasValidCoA ? "Yes" : "No",
    a.hasHealthPermit ? "Yes" : "No",
    a.healthPermitNumber ?? "",
    a.brandAuthenticityVerified ? "Yes" : "No",
    a.counterfeitRisk,
    a.packagingIssueFlag ? "Yes" : "No",
    a.batchCodeIssueFlag ? "Yes" : "No",
    a.pricingAnomalyFlag ? "Yes" : "No",
    a.counterfeitNotes ?? "",
    a.status,
  ]);

  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="real-makoya-export-${Date.now()}.csv"`,
    },
  });
}
