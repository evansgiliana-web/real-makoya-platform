import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tradingAs: { contains: q, mode: "insensitive" } },
        { town: { contains: q, mode: "insensitive" } },
        { ownerName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, town: true, province: true, ownerName: true },
    take: 8,
  });

  return NextResponse.json(stores);
}
