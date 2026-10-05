import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";

// Accepts a single image file from a multipart form and stores it in
// Vercel Blob, returning a public URL to save on a Store or Assessment.
// Any logged-in agency role (not CLIENT) can upload photos during capture.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clear diagnostic when the token is missing — this is the #1 cause of "photos not uploading"
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[upload] BLOB_READ_WRITE_TOKEN is not set");
    return NextResponse.json(
      {
        error:
          "Photo storage is not configured. Set BLOB_READ_WRITE_TOKEN in your environment (Vercel Blob).",
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

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "photo.jpg";
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
