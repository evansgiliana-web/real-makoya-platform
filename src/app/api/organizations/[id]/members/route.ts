import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, isOrgOwner } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { Role, OrgRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema, firstIssue } from "@/lib/validation";

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  orgRole: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
  allBrandsAccess: z.boolean().default(true),
  brandIds: z.array(z.string()).default([]),
});

async function canManageThisOrg(
  userId: string,
  role: Role,
  organizationId: string
) {
  if (can(role, "org:manage")) return true;
  const membership = await prisma.orgMembership.findFirst({
    where: { userId, organizationId },
  });
  return isOrgOwner(membership?.orgRole);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canManageThisOrg(
    session.user.id,
    session.user.role as Role,
    params.id
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssue(parsed.error), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const orgRole =
    parsed.data.orgRole === "OWNER" ? OrgRole.OWNER : OrgRole.MEMBER;

  const membership = await prisma.orgMembership.create({
    data: {
      organization: { connect: { id: params.id } },
      orgRole,
      allBrandsAccess: parsed.data.allBrandsAccess,
      brandIds: parsed.data.allBrandsAccess ? [] : parsed.data.brandIds,
      user: {
        create: {
          name: parsed.data.name,
          email,
          passwordHash,
          role: Role.CLIENT,
          active: true,
          invitedById: session.user.id,
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "organization.member_invited",
    entityType: "Organization",
    entityId: params.id,
    after: {
      invitedEmail: email,
      orgRole: parsed.data.orgRole,
    },
  });

  return NextResponse.json(membership, { status: 201 });
}