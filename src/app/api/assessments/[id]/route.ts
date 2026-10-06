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

const assessmentUpdateSchema = z.object({
  visitDate: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED", "FLAGGED"]).optional(),

  productLines: z.array(productLineSchema).optional(),

  sourceType: z
    .enum(["FORMAL_WHOLESALER", "INFORMAL_BULK_BUYER", "UNVERIFIED_SUPPLIER", "MIXED"])
    .optional(),
  supplierName: z.string().optional().nullable(),
  supplierLocation: z.string().optional().nullable(),
  distributionNotes: z.string().optional().nullable(),

  hasValidCoA: z.boolean().optional(),
  coaNotes: z.string().optional().nullable(),
  hasHealthPermit: z.boolean().optional(),
  healthPermitNumber: z.string().optional().nullable(),
  healthPermitExpiry: z.string().optional().nullable(),
  brandAuthenticityVerified: z.boolean().optional(),
  complianceNotes: z.string().optional().nullable(),

  counterfeitRisk: z
    .enum(["NONE", "LOW", "MEDIUM", "HIGH", "CONFIRMED_COUNTERFEIT"])
    .optional(),
  packagingIssueFlag: z.boolean().optional(),
  batchCodeIssueFlag: z.boolean().optional(),
  pricingAnomalyFlag: z.boolean().optional(),
  counterfeitNotes: z.string().optional().nullable(),
  photoUrls: z.array(z.string()).optional(),

  packingShelvesCount: z.number().int().optional().nullable(),
  posInstalled: z.boolean().optional(),
  posBrand: z.string().optional().nullable(),
  posModel: z.string().optional().nullable(),
  posPhotoUrls: z.array(z.string()).optional(),
  internetConnectivity: z
    .enum(["NONE", "MOBILE_DATA", "WIFI", "FIBER", "UNKNOWN"])
    .optional(),
  scannerInstalled: z.boolean().optional(),
  scannerDetails: z.string().optional().nullable(),
  equipmentPhotoUrls: z.array(z.string()).optional(),

  totalSkuCount: z.number().int().optional().nullable(),
  estimatedMonthlyTurnoverZar: z.number().optional().nullable(),

  internalNotes: z.string().optional().nullable(),
  reviewNotes: z.string().optional().nullable(),

  // Special actions
  action: z.enum(["review", "flag"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { productLines: true, store: true, agent: { select: { name: true } } },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(assessment);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = assessmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { store: true, agent: { select: { name: true } }, productLines: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── QA Review action (Admin / Super Admin only; cannot review own work) ──
  if (parsed.data.action === "review" || parsed.data.action === "flag") {
    if (!can(session.user.role, "assessment:review")) {
      return NextResponse.json({ error: "Forbidden — only Admin can review" }, { status: 403 });
    }
    // Separation of duties: agent cannot approve their own assessment
    if (existing.agentId === session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "You cannot review an assessment you captured (separation of duties)." },
        { status: 403 }
      );
    }

    const newStatus = parsed.data.action === "flag" ? "FLAGGED" : "REVIEWED";
    const updated = await prisma.assessment.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        reviewNotes: parsed.data.reviewNotes ?? existing.reviewNotes,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email,
      actorRole: session.user.role,
      action: parsed.data.action === "flag" ? "assessment.flag" : "assessment.review",
      entityType: "Assessment",
      entityId: params.id,
      before: { status: existing.status },
      after: { status: newStatus, reviewedById: session.user.id },
      meta: { reviewNotes: parsed.data.reviewNotes },
    });

    return NextResponse.json(updated);
  }

  // ── Normal edit ──
  if (!can(session.user.role, "assessment:edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Field agents cannot push status to REVIEWED themselves
  if (
    parsed.data.status === "REVIEWED" &&
    !can(session.user.role, "assessment:review")
  ) {
    return NextResponse.json(
      { error: "Only Admin can mark an assessment as Reviewed." },
      { status: 403 }
    );
  }

  const { productLines, healthPermitExpiry, visitDate, action, ...rest } = parsed.data;
  void action;

  const data: Record<string, unknown> = { ...rest };
  if (visitDate) data.visitDate = new Date(visitDate);
  if (healthPermitExpiry !== undefined) {
    data.healthPermitExpiry = healthPermitExpiry ? new Date(healthPermitExpiry) : null;
  }

  // Replace product lines if provided
  if (productLines) {
    const brandIdByName = await matchBrandIds(productLines.map((p) => p.brand));
    await prisma.productLine.deleteMany({ where: { assessmentId: params.id } });
    await prisma.productLine.createMany({
      data: productLines.map((p) => ({
        assessmentId: params.id,
        category: p.category,
        brand: p.brand,
        brandId: brandIdByName[p.brand.trim()] ?? null,
        rank: p.rank ?? null,
        estimatedMonthlyUnits: p.estimatedMonthlyUnits ?? null,
        estimatedUnitPriceZar: p.estimatedUnitPriceZar ?? null,
        notes: p.notes,
      })),
    });
  }

  const assessment = await prisma.assessment.update({
    where: { id: params.id },
    data,
    include: { store: true, agent: { select: { name: true } } },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "assessment.update",
    entityType: "Assessment",
    entityId: params.id,
    before: {
      status: existing.status,
      counterfeitRisk: existing.counterfeitRisk,
    },
    after: {
      status: assessment.status,
      counterfeitRisk: assessment.counterfeitRisk,
    },
  });

  // Alert if risk was escalated to HIGH / CONFIRMED
  const wasHigh =
    existing.counterfeitRisk === "HIGH" ||
    existing.counterfeitRisk === "CONFIRMED_COUNTERFEIT";
  const isHigh =
    assessment.counterfeitRisk === "HIGH" ||
    assessment.counterfeitRisk === "CONFIRMED_COUNTERFEIT";
  if (isHigh && !wasHigh) {
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

  return NextResponse.json(assessment);
}
