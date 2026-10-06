import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { sendHighRiskAlert } from "@/lib/email";
import { matchBrandIds } from "@/lib/brandMatch";
import { z } from "zod";

const productLineSchema = z.object({
  category: z.string().min(1),
  brand: z.string().min(1),
  rank: z.number().int().optional().nullable(),
  estimatedMonthlyUnits: z.number().int().optional().nullable(),
  estimatedUnitPriceZar: z.number().optional().nullable(),
  notes: z.string().optional(),
});

const assessmentSchema = z.object({
  storeId: z.string(),
  visitDate: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED", "FLAGGED"]).optional(),

  productLines: z.array(productLineSchema).default([]),

  sourceType: z.enum(["FORMAL_WHOLESALER", "INFORMAL_BULK_BUYER", "UNVERIFIED_SUPPLIER", "MIXED"]),
  supplierName: z.string().optional(),
  supplierLocation: z.string().optional(),
  distributionNotes: z.string().optional(),

  hasValidCoA: z.boolean().default(false),
  coaNotes: z.string().optional(),
  hasHealthPermit: z.boolean().default(false),
  healthPermitNumber: z.string().optional(),
  healthPermitExpiry: z.string().optional().nullable(),
  brandAuthenticityVerified: z.boolean().default(false),
  complianceNotes: z.string().optional(),

  counterfeitRisk: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CONFIRMED_COUNTERFEIT"]).default("NONE"),
  packagingIssueFlag: z.boolean().default(false),
  batchCodeIssueFlag: z.boolean().default(false),
  pricingAnomalyFlag: z.boolean().default(false),
  counterfeitNotes: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),

  packingShelvesCount: z.number().int().optional().nullable(),
  posInstalled: z.boolean().default(false),
  posBrand: z.string().optional(),
  posModel: z.string().optional(),
  posPhotoUrls: z.array(z.string()).default([]),
  internetConnectivity: z.enum(["NONE", "MOBILE_DATA", "WIFI", "FIBER", "UNKNOWN"]).default("UNKNOWN"),
  scannerInstalled: z.boolean().default(false),
  scannerDetails: z.string().optional(),
  equipmentPhotoUrls: z.array(z.string()).default([]),

  totalSkuCount: z.number().int().optional().nullable(),
  estimatedMonthlyTurnoverZar: z.number().optional().nullable(),

  internalNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "assessment:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = assessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productLines, healthPermitExpiry, visitDate, ...rest } = parsed.data;

  // New assessments start as SUBMITTED (pending QA). Only Admin can set REVIEWED.
  const status = rest.status === "DRAFT" ? "DRAFT" : "SUBMITTED";

  // Link each typed brand name to the Brand catalog when it matches a
  // partnered brand — unmatched names (competitors, not-yet-partnered
  // brands) stay as plain text, which is still useful demand data.
  const brandIdByName = await matchBrandIds(productLines.map((p) => p.brand));

  const assessment = await prisma.assessment.create({
    data: {
      ...rest,
      status,
      storeId: parsed.data.storeId,
      agentId: session.user.id,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      healthPermitExpiry: healthPermitExpiry ? new Date(healthPermitExpiry) : null,
      productLines: {
        create: productLines.map((p) => ({
          category: p.category,
          brand: p.brand,
          brandId: brandIdByName[p.brand.trim()] ?? null,
          rank: p.rank ?? null,
          estimatedMonthlyUnits: p.estimatedMonthlyUnits ?? null,
          estimatedUnitPriceZar: p.estimatedUnitPriceZar ?? null,
          notes: p.notes,
        })),
      },
    },
    include: { store: true, agent: { select: { name: true } } },
  });

  // Bump store nextVisitDue based on cadence
  const store = await prisma.store.findUnique({ where: { id: parsed.data.storeId } });
  if (store) {
    const cadence = store.visitCadenceDays || 90;
    await prisma.store.update({
      where: { id: store.id },
      data: {
        nextVisitDue: new Date(Date.now() + cadence * 24 * 60 * 60 * 1000),
      },
    });
  }

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "assessment.create",
    entityType: "Assessment",
    entityId: assessment.id,
    after: {
      storeId: assessment.storeId,
      status: assessment.status,
      counterfeitRisk: assessment.counterfeitRisk,
    },
  });

  // High-risk alert
  if (
    assessment.counterfeitRisk === "HIGH" ||
    assessment.counterfeitRisk === "CONFIRMED_COUNTERFEIT"
  ) {
    await sendHighRiskAlert({
      storeName: assessment.store.name,
      storeTown: assessment.store.town,
      storeProvince: assessment.store.province,
      assessmentId: assessment.id,
      risk: assessment.counterfeitRisk,
      notes: assessment.counterfeitNotes,
      agentName: assessment.agent.name,
      visitDate: assessment.visitDate.toISOString().slice(0, 10),
    });
  }

  return NextResponse.json(assessment, { status: 201 });
}
