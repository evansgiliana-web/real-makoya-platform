import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createOrgSchema = z.object({
  name: z.string().min(2),
  logoUrl: z.string().url().optional(),
  brandNames: z.array(z.string().min(1)).min(1, "Add at least one brand"),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "org:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      brands: { select: { id: true, name: true, category: true } },
      memberships: {
        select: { orgRole: true, user: { select: { name: true, email: true, active: true } } },
      },
    },
  });

  return NextResponse.json(organizations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "org:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.ownerEmail.toLowerCase() },
  });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.ownerPassword, 12);

  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl,
      brands: { create: parsed.data.brandNames.map((name) => ({ name })) },
      memberships: {
        create: {
          orgRole: "OWNER",
          allBrandsAccess: true,
          user: {
            create: {
              name: parsed.data.ownerName,
              email: parsed.data.ownerEmail.toLowerCase(),
              passwordHash,
              role: "CLIENT",
              invitedById: session.user.id,
            },
          },
        },
      },
    },
    include: { brands: true, memberships: { include: { user: { select: { name: true, email: true } } } } },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "organization.create",
    entityType: "Organization",
    entityId: organization.id,
    after: { name: organization.name, brands: parsed.data.brandNames },
  });

  return NextResponse.json(organization, { status: 201 });
}
