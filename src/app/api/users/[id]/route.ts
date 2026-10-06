import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (params.id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own access level here." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const allowed = ["active", "role"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) data[key] = body[key];

  if (["SUPER_ADMIN", "ADMIN"].includes(data.role as string) && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only a Super Admin can grant Admin or Super Admin access." },
      { status: 403 }
    );
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  // Soft-delete: deactivate rather than remove, to preserve the audit trail
  // of who captured which assessments.
  await prisma.user.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
