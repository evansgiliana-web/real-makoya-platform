import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
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
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // CLIENT role sees stores only through the aggregated reports endpoint,
  // not the raw management list.
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

  const store = await prisma.store.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(store, { status: 201 });
}
