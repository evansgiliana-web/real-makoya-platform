/**
 * One-off: encrypt owner documents that were uploaded BEFORE encryption existed.
 * Those files are currently readable by anyone who has their link.
 *
 *   npx tsx scripts/encrypt-existing-documents.ts            (dry run: changes nothing)
 *   npx tsx scripts/encrypt-existing-documents.ts --apply    (does the work)
 *
 * Needs DATABASE_URL, BLOB_READ_WRITE_TOKEN and DOCUMENT_ENCRYPTION_KEY in .env.
 * Safe to re-run: files that are already encrypted are skipped.
 *
 * For each document it (1) downloads the old file, (2) uploads an encrypted copy,
 * (3) checks the copy decrypts back to the identical bytes, (4) switches the
 * database to the new link, and only then (5) deletes the old public file.
 * If any step fails, the old file is left exactly as it was.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { put, del } from "@vercel/blob";
import { encryptDocument, decryptDocument, isEncryptedDocument, parseKey } from "../src/lib/docCrypto";
import { sniffContentType } from "../src/lib/fileSniff";
import { OWNER_DOCUMENT_KINDS, isOurBlobUrl } from "../src/lib/policies";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const FIELDS = Object.values(OWNER_DOCUMENT_KINDS);

async function main() {
  const key = parseKey(process.env.DOCUMENT_ENCRYPTION_KEY);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set.");

  console.log(apply ? "APPLY MODE: changing data." : "DRY RUN: nothing will be changed. Add --apply to do the work.");

  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { ownerConsentDocumentUrl: { not: null } },
        { municipalRegistrationDocumentUrl: { not: null } },
        { ownershipDocumentUrl: { not: null } },
        { businessLicenseDocumentUrl: { not: null } },
      ],
    },
    select: {
      id: true,
      ownerConsentDocumentUrl: true,
      municipalRegistrationDocumentUrl: true,
      ownershipDocumentUrl: true,
      businessLicenseDocumentUrl: true,
    },
  });

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const store of stores) {
    for (const field of FIELDS) {
      const url = store[field];
      if (!url) continue;

      if (!isOurBlobUrl(url)) {
        console.log(`SKIP    ${store.id} ${field}: link is not on our storage`);
        skipped++;
        continue;
      }

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
        const bytes = Buffer.from(await res.arrayBuffer());

        if (isEncryptedDocument(bytes)) {
          skipped++;
          continue; // already protected
        }
        const type = sniffContentType(bytes);
        if (!type) throw new Error("not a recognised PDF/image; left untouched");

        if (!apply) {
          console.log(`WOULD   ${store.id} ${field} (${type}, ${bytes.length} bytes)`);
          done++;
          continue;
        }

        const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "document").slice(0, 120);
        const blob = await put(
          `private-docs/migrated/${store.id}-${field}.bin`,
          encryptDocument(bytes, { name, type }, key),
          { access: "public", addRandomSuffix: true, contentType: "application/octet-stream", token }
        );

        // Prove the encrypted copy is good BEFORE touching the original.
        const check = await fetch(blob.url, { cache: "no-store" });
        const roundTrip = decryptDocument(Buffer.from(await check.arrayBuffer()), key);
        if (!roundTrip.data.equals(bytes)) {
          await del(blob.url, { token });
          throw new Error("verification failed; encrypted copy removed, original untouched");
        }

        const update: Prisma.StoreUpdateInput = {};
        update[field] = blob.url;
        await prisma.store.update({ where: { id: store.id }, data: update });
        await del(url, { token }); // only now is the old public file removed
        console.log(`DONE    ${store.id} ${field}`);
        done++;
      } catch (err) {
        failed++;
        console.error(`FAILED  ${store.id} ${field}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n${apply ? "Encrypted" : "Would encrypt"}: ${done}   Skipped: ${skipped}   Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
