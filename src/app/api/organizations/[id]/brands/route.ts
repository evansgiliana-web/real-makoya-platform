import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const brandSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});

// Adding brands is agency-only — it's the shared catalog every assessment's
// product lines get matched against, so quality control matters here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "org:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const brand = await prisma.brand.create({
    data: { organizationId: params.id, name: parsed.data.name, category: parsed.data.category },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "organization.brand_added",
    entityType: "Organization",
    entityId: params.id,
    after: { brand: brand.name },
  });

  return NextResponse.json(brand, { status: 201 });
}
