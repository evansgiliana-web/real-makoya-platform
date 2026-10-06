import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAgencyStaff = can(session.user.role, "org:manage");

  if (!isAgencyStaff) {
    // A CLIENT user may only view their own organization
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: session.user.id, organizationId: params.id },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      brands: true,
      memberships: {
        include: { user: { select: { id: true, name: true, email: true, active: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(organization);
}
