import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

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
  if (!can(session.user.role, "store:edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const store = await prisma.store.update({ where: { id: params.id }, data: body });
  return NextResponse.json(store);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "store:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.store.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
