import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { z } from "zod";

const productLineSchema = z.object({
  category: z.string().min(1),
  brand: z.string().min(1),
  rank: z.number().int().optional().nullable(),
  estimatedMonthlyUnits: z.number().int().optional().nullable(),
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

  const assessment = await prisma.assessment.create({
    data: {
      ...rest,
      storeId: parsed.data.storeId,
      agentId: session.user.id,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      healthPermitExpiry: healthPermitExpiry ? new Date(healthPermitExpiry) : null,
      productLines: {
        create: productLines.map((p) => ({
          category: p.category,
          brand: p.brand,
          rank: p.rank ?? null,
          estimatedMonthlyUnits: p.estimatedMonthlyUnits ?? null,
          notes: p.notes,
        })),
      },
    },
    include: { productLines: true },
  });

  return NextResponse.json(assessment, { status: 201 });
}
