import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { writeAuditLog } from "@/lib/audit";
import { encryptDocument, parseKey } from "@/lib/docCrypto";
import { sniffContentType } from "@/lib/fileSniff";
import { checkSensitiveUpload } from "@/lib/policies";

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

  // ── Sensitive owner documents: encrypted BEFORE they reach storage ──
  // (ID copies, signed consent forms, registration papers.) Storage only ever
  // holds unreadable bytes; the file is readable solely through the
  // authenticated /api/stores/[id]/documents/[kind] route.
  if (form.get("sensitive") === "true") {
    let key: Buffer;
    try {
      key = parseKey(process.env.DOCUMENT_ENCRYPTION_KEY);
    } catch (err) {
      console.error("[upload] document encryption is not configured:", (err as Error).message);
      return NextResponse.json(
        { error: "Secure document storage is not configured. Set DOCUMENT_ENCRYPTION_KEY." },
        { status: 503 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const check = checkSensitiveUpload({
      declaredType: file.type,
      size: bytes.length,
      sniffedType: sniffContentType(bytes),
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    // The real file name lives only inside the encrypted envelope, never in the storage path.
    const meta = { name: file.name.slice(0, 120) || "document", type: check.type };
    const encrypted = encryptDocument(bytes, meta, key);

    try {
      const blob = await put(`private-docs/${session.user.id}/document.bin`, encrypted, {
        access: "public", // the bytes are ciphertext, so the link alone reveals nothing
        addRandomSuffix: true,
        contentType: "application/octet-stream",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      await writeAuditLog({
        actorId: session.user.id,
        actorEmail: session.user.email,
        actorRole: session.user.role,
        action: "document.upload",
        entityType: "Document",
        entityId: blob.pathname,
        meta: { encrypted: true, type: check.type, bytes: bytes.length },
      });
      return NextResponse.json({ url: blob.url, encrypted: true });
    } catch (err) {
      console.error("[upload] Vercel Blob put failed (sensitive)", err);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }
  }

  // ── Ordinary photos and compliance documents ──
  // SVG can carry scripts, so it is never accepted even though it is an "image/*".
  const allowedType = ALLOWED.has(file.type) || (file.type.startsWith("image/") && file.type !== "image/svg+xml");
  if (!allowedType) {
    return NextResponse.json({ error: "Only images or PDF files are allowed" }, { status: 400 });
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
