import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { z } from "zod";

const orgSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["AGENCY", "FMCG", "OTHER"]).default("FMCG"),
  website: z.string().url().optional().or(z.literal("")),
  registrationNumber: z.string().optional(),
  brands: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().optional(),
      })
    )
    .default([]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "org:manage") && session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === "CLIENT") {
    const memberships = await prisma.organisationMember.findMany({
      where: { userId: session.user.id, active: true },
      include: {
        organisation: {
          include: {
            brands: { where: { active: true } },
            departments: true,
          },
        },
      },
    });
    return NextResponse.json(memberships.map((m) => m.organisation));
  }

  const orgs = await prisma.organisation.findMany({
    orderBy: { name: "asc" },
    include: {
      brands: { where: { active: true } },
      departments: true,
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "org:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = orgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, type, website, registrationNumber, brands } = parsed.data;

  const org = await prisma.organisation.create({
    data: {
      name,
      type,
      website: website || null,
      registrationNumber: registrationNumber || null,
      brands: {
        create: brands.map((b) => ({
          name: b.name,
          category: b.category || null,
        })),
      },
      departments: {
        create: [{ name: "Trade Marketing" }],
      },
    },
    include: { brands: true, departments: true },
  });

  return NextResponse.json(org, { status: 201 });
}
