import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "FIELD_AGENT", "CLIENT"]),
  companyName: z.string().optional(),
  allBrandsAccess: z.boolean().default(true),
  brandAccess: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      companyName: true,
      allBrandsAccess: true,
      createdAt: true,
      brandAccess: { select: { brandName: true } },
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only a SUPER_ADMIN can create another SUPER_ADMIN or ADMIN account.
  const body = await req.json();
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (
    ["SUPER_ADMIN", "ADMIN"].includes(parsed.data.role) &&
    session.user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json(
      { error: "Only a Super Admin can create Admin or Super Admin accounts." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      companyName: parsed.data.companyName,
      allBrandsAccess: parsed.data.role === "CLIENT" ? parsed.data.allBrandsAccess : true,
      invitedById: session.user.id,
      brandAccess:
        parsed.data.role === "CLIENT" && !parsed.data.allBrandsAccess
          ? { create: parsed.data.brandAccess.map((brandName) => ({ brandName })) }
          : undefined,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
