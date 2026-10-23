import { del } from "@vercel/blob";
import { isOurBlobUrl } from "@/lib/policies";

/**
 * Permanently delete stored files. Used when a document is replaced or removed,
 * when a store's personal information is redacted, and when a store is deleted,
 * so an owner's ID copy never lingers in storage after it is no longer needed.
 *
 * Best-effort: a storage hiccup is logged but never fails the request that
 * triggered it (the database change has already happened).
 */
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const targets = urls.filter((u): u is string => typeof u === "string" && isOurBlobUrl(u));
  if (targets.length === 0) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[blobStore] BLOB_READ_WRITE_TOKEN not set; could not delete", targets.length, "file(s)");
    return;
  }
  try {
    await del(targets, { token });
  } catch (err) {
    console.error("[blobStore] failed to delete files", err);
  }
}
