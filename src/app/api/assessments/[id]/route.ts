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

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { productLines: true, store: true, agent: { select: { name: true } } },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(assessment);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "assessment:edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { productLines, ...rest } = body;

  const assessment = await prisma.assessment.update({
    where: { id: params.id },
    data: rest,
  });

  return NextResponse.json(assessment);
}
