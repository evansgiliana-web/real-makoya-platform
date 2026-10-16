import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload] BLOB_READ_WRITE_TOKEN is not set");
    return NextResponse.json(
      {
        error:
          "File storage is not configured. Set BLOB_READ_WRITE_TOKEN in your environment (Vercel Blob).",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED.has(file.type) && !file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only images or PDF files are allowed" },
      { status: 400 }
    );
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 12MB" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
  const key = `real-makoya/${session.user.id}/${Date.now()}-${safeName}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[upload] Vercel Blob put failed", err);
    return NextResponse.json(
      { error: "Upload failed. Check BLOB_READ_WRITE_TOKEN and try again." },
      { status: 500 }
    );
  }
}
