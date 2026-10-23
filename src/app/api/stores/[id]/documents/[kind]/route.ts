import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { decryptDocument, isEncryptedDocument, parseKey } from "@/lib/docCrypto";
import { sniffContentType } from "@/lib/fileSniff";
import {
  OWNER_DOCUMENT_KINDS,
  INLINE_DOCUMENT_TYPES,
  canViewOwnerDocuments,
  contentDisposition,
  isOurBlobUrl,
  isOwnerDocumentKind,
} from "@/lib/policies";

/**
 * The ONLY way to read a store's owner documents (consent form, registration,
 * ownership/ID proof, trading licence). It checks who is asking, decrypts the
 * file, and records the access in the audit log.
 *
 *   GET /api/stores/<storeId>/documents/<consent|registration|ownership|license>
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; kind: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isOwnerDocumentKind(params.kind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const store = await prisma.store.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      createdById: true,
      ownerConsentDocumentUrl: true,
      municipalRegistrationDocumentUrl: true,
      ownershipDocumentUrl: true,
      businessLicenseDocumentUrl: true,
    },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    !canViewOwnerDocuments({
      role: session.user.role,
      userId: session.user.id,
      storeCreatedById: store.createdById,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = store[OWNER_DOCUMENT_KINDS[params.kind]];
  if (!url) return NextResponse.json({ error: "No document on file" }, { status: 404 });
  if (!isOurBlobUrl(url)) {
    console.error("[documents] stored link is not on our storage host for store", store.id);
    return NextResponse.json({ error: "Document unavailable" }, { status: 502 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Document storage is unreachable" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "Document unavailable" }, { status: 502 });
  }
  const stored = Buffer.from(await upstream.arrayBuffer());

  let body: Buffer;
  let type: string;
  let name: string;
  let encrypted = false;

  if (isEncryptedDocument(stored)) {
    try {
      const decrypted = decryptDocument(stored, parseKey(process.env.DOCUMENT_ENCRYPTION_KEY));
      body = decrypted.data;
      type = decrypted.meta.type;
      name = decrypted.meta.name;
      encrypted = true;
    } catch (err) {
      // Wrong key, missing key, or the stored bytes were altered.
      console.error("[documents] could not decrypt document for store", store.id, (err as Error).message);
      return NextResponse.json({ error: "Document could not be opened" }, { status: 500 });
    }
  } else {
    // A document uploaded before encryption existed. Still access-controlled and
    // logged here; run scripts/encrypt-existing-documents.ts to protect the file itself.
    body = stored;
    type = sniffContentType(stored) ?? "application/octet-stream";
    name = params.kind;
  }

  await writeAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    action: "document.view",
    entityType: "Store",
    entityId: store.id,
    meta: { kind: params.kind, encrypted },
  });

  // Anything that isn't a plain PDF/image is forced to download, never rendered.
  const inline = INLINE_DOCUMENT_TYPES.has(type);
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", name),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
