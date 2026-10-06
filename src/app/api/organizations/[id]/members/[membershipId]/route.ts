import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, isOrgOwner } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; membershipId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAgencyStaff = can(session.user.role, "org:manage");
  if (!isAgencyStaff) {
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: session.user.id, organizationId: params.id },
    });
    if (!isOrgOwner(membership?.orgRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const target = await prisma.orgMembership.findUnique({ where: { id: params.membershipId } });
  if (!target || target.organizationId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
  }

  // Deactivate the user rather than hard-deleting, so their captured audit
  // history (if any) and past report access stay traceable.
  await prisma.$transaction([
    prisma.orgMembership.delete({ where: { id: params.membershipId } }),
    prisma.user.update({ where: { id: target.userId }, data: { active: false } }),
  ]);

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "organization.member_removed",
    entityType: "Organization",
    entityId: params.id,
    after: { removedUserId: target.userId },
  });

  return NextResponse.json({ ok: true });
}
