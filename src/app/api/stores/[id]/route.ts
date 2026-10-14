import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const storeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  tradingAs: z.string().optional().nullable(),
  address: z.string().min(2).optional(),
  town: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  ownerName: z.string().min(2).optional(),
  ownerContactNumber: z.string().optional().nullable(),
  ownerIdOrCompanyRegNumber: z.string().optional().nullable(),
  municipalRegistrationStatus: z
    .enum(["REGISTERED", "PENDING", "UNREGISTERED", "UNKNOWN"])
    .optional(),
  municipalRegistrationNumber: z.string().optional().nullable(),
  registrationNotes: z.string().optional().nullable(),
  storeTelephoneNumber: z.string().optional().nullable(),
  storePhotoUrls: z.array(z.string()).optional(),
  ownerConsentGiven: z.boolean().optional(),
  visitCadenceDays: z.number().int().min(7).max(365).optional(),
  nextVisitDue: z.string().optional().nullable(),
  action: z.enum(["redact_pii"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const store = await prisma.store.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      assessments: {
        orderBy: { visitDate: "desc" },
        include: {
          productLines: true,
          agent: { select: { name: true } },
        },
      },
    },
  });

  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(store);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = storeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.store.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── PII redaction action ──
  if (parsed.data.action === "redact_pii") {
    if (!can(session.user.role, "store:redact-pii")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const redacted = await prisma.store.update({
      where: { id: params.id },
      data: {
        ownerContactNumber: null,
        ownerIdOrCompanyRegNumber: null,
        storeTelephoneNumber: null,
        piiRedacted: true,
        piiRedactedAt: new Date(),
        piiRedactedById: session.user.id,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorEmail: session.user.email,
      actorRole: session.user.role,
      action: "store.redact_pii",
      entityType: "Store",
      entityId: params.id,
      before: {
        ownerContactNumber: existing.ownerContactNumber,
        ownerIdOrCompanyRegNumber: existing.ownerIdOrCompanyRegNumber,
        storeTelephoneNumber: existing.storeTelephoneNumber,
      },
      after: { piiRedacted: true },
    });

    return NextResponse.json(redacted);
  }

  // ── Normal edit ──
  if (!can(session.user.role, "store:edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const writingPii =
    (parsed.data.ownerContactNumber != null && parsed.data.ownerContactNumber !== "") ||
    (parsed.data.ownerIdOrCompanyRegNumber != null &&
      parsed.data.ownerIdOrCompanyRegNumber !== "");
  if (writingPii && !existing.ownerConsentGiven && !parsed.data.ownerConsentGiven) {
    return NextResponse.json(
      { error: "Owner consent is required before storing ID/contact details (POPIA)." },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = { ...parsed.data };
  delete data.action;

  if (parsed.data.ownerConsentGiven === true && !existing.ownerConsentGiven) {
    data.ownerConsentAt = new Date();
    data.ownerConsentById = session.user.id;
  }

  if (parsed.data.nextVisitDue !== undefined) {
    data.nextVisitDue = parsed.data.nextVisitDue ? new Date(parsed.data.nextVisitDue) : null;
  }

  const store = await prisma.store.update({
    where: { id: params.id },
    data,
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "store.update",
    entityType: "Store",
    entityId: params.id,
    before: {
      name: existing.name,
      ownerName: existing.ownerName,
      nextVisitDue: existing.nextVisitDue,
    },
    after: {
      name: store.name,
      ownerName: store.ownerName,
      nextVisitDue: store.nextVisitDue,
    },
  });

  return NextResponse.json(store);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "store:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.store.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "store.delete",
    entityType: "Store",
    entityId: params.id,
  });

  return NextResponse.json({ ok: true });
}
