import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const storeSchema = z.object({
  name: z.string().min(2),
  tradingAs: z.string().optional(),
  address: z.string().min(2),
  town: z.string().min(1),
  province: z.string().min(1),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  ownerName: z.string().min(2),
  ownerContactNumber: z.string().optional(),
  ownerIdOrCompanyRegNumber: z.string().optional(),
  municipalRegistrationStatus: z.enum(["REGISTERED", "PENDING", "UNREGISTERED", "UNKNOWN"]),
  municipalRegistrationNumber: z.string().optional(),
  registrationNotes: z.string().optional(),
  storeTelephoneNumber: z.string().optional(),
  storePhotoUrls: z.array(z.string()).default([]),
  // POPIA
  ownerConsentGiven: z.boolean(),
  // Visit cadence
  visitCadenceDays: z.number().int().min(7).max(365).optional(),
  nextVisitDue: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      assessments: {
        orderBy: { visitDate: "desc" },
        take: 1,
        select: { visitDate: true, counterfeitRisk: true, status: true },
      },
      _count: { select: { assessments: true } },
    },
  });

  return NextResponse.json(stores);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "store:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = storeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // POPIA: refuse to store owner contact / ID without explicit consent
  if (!parsed.data.ownerConsentGiven) {
    return NextResponse.json(
      {
        error:
          "Owner consent is required before storing ID number or contact details (POPIA). Tick the consent checkbox.",
      },
      { status: 400 }
    );
  }

  const cadence = parsed.data.visitCadenceDays ?? 90;
  const nextDue = parsed.data.nextVisitDue
    ? new Date(parsed.data.nextVisitDue)
    : new Date(Date.now() + cadence * 24 * 60 * 60 * 1000);

  const store = await prisma.store.create({
    data: {
      name: parsed.data.name,
      tradingAs: parsed.data.tradingAs,
      address: parsed.data.address,
      town: parsed.data.town,
      province: parsed.data.province,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      ownerName: parsed.data.ownerName,
      ownerContactNumber: parsed.data.ownerContactNumber,
      ownerIdOrCompanyRegNumber: parsed.data.ownerIdOrCompanyRegNumber,
      municipalRegistrationStatus: parsed.data.municipalRegistrationStatus,
      municipalRegistrationNumber: parsed.data.municipalRegistrationNumber,
      registrationNotes: parsed.data.registrationNotes,
      storeTelephoneNumber: parsed.data.storeTelephoneNumber,
      storePhotoUrls: parsed.data.storePhotoUrls,
      ownerConsentGiven: true,
      ownerConsentAt: new Date(),
      ownerConsentById: session.user.id,
      visitCadenceDays: cadence,
      nextVisitDue: nextDue,
      createdById: session.user.id,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "store.create",
    entityType: "Store",
    entityId: store.id,
    after: {
      name: store.name,
      town: store.town,
      ownerConsentGiven: true,
    },
  });

  return NextResponse.json(store, { status: 201 });
}
