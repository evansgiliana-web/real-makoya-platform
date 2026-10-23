import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

function checkUserChange({
  actor,
  target,
  change,
  activeSuperAdmins,
}: {
  actor: { id: string; role: Role };
  target: { id: string; role: Role; active: boolean };
  change: z.infer<typeof patchSchema>;
  activeSuperAdmins: number;
}): { ok: true } | { ok: false; reason: string } {
  const isSuperAdmin = actor.role === Role.SUPER_ADMIN;
  const isSelf = actor.id === target.id;

  if (!isSuperAdmin && target.role === Role.SUPER_ADMIN) {
    return { ok: false, reason: "Only a super admin can modify a super admin" };
  }
  if (!isSuperAdmin && (change.role !== undefined || change.active !== undefined)) {
    return { ok: false, reason: "Only a super admin can change roles or account status" };
  }
  if (isSelf && (change.role !== undefined || change.active === false)) {
    return { ok: false, reason: "You cannot change your own role or deactivate your account" };
  }
  if (
    target.role === Role.SUPER_ADMIN &&
    target.active &&
    activeSuperAdmins <= 1 &&
    ((change.role !== undefined && change.role !== Role.SUPER_ADMIN) || change.active === false)
  ) {
    return { ok: false, reason: "At least one active super admin must remain" };
  }

  return { ok: true };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorId = session.user.id;
  const actorRole = session.user.role;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const change = parsed.data;

  const activeSuperAdmins = await prisma.user.count({
    where: { role: Role.SUPER_ADMIN, active: true },
  });

  const verdict = checkUserChange({
    actor: { id: actorId, role: actorRole },
    target: { id: target.id, role: target.role, active: target.active },
    change,
    activeSuperAdmins,
  });

  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 403 });
  }

  const data: {
    name?: string;
    role?: Role;
    active?: boolean;
    passwordHash?: string;
  } = {};

  if (change.name !== undefined) data.name = change.name;
  if (change.role !== undefined) data.role = change.role;
  if (change.active !== undefined) data.active = change.active;

  if (change.password) {
    const { hash } = await import("bcryptjs");
    data.passwordHash = await hash(change.password, 12);
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}