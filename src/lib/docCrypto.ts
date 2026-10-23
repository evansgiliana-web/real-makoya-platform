/**
 * Encryption for sensitive owner documents (ID copies, signed consent forms,
 * registration papers).
 *
 * Why: file storage hands out a public link for every upload. By encrypting the
 * file BEFORE it is stored, a leaked or guessed link yields only unreadable
 * bytes. The only way to read a document is through the authenticated
 * download route, which checks the user's role and logs the access.
 *
 * Format (all in one blob):
 *   "MKYD" | version(1) | iv(12) | AES-256-GCM ciphertext | auth tag(16)
 * The plaintext inside is: metaLength(4, big-endian) | meta JSON | file bytes,
 * so the original file name and type travel inside the encrypted envelope
 * rather than in a readable storage path. The header is authenticated (AAD),
 * so tampering with any byte makes decryption fail loudly.
 *
 * Uses only Node's built-in crypto: no extra dependency.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("MKYD");
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const AAD_LEN = MAGIC.length + 1;
const HEADER_LEN = AAD_LEN + IV_LEN;
const MAX_META_BYTES = 4096;

export type DocMeta = { name: string; type: string };

/** Reads the key from the environment value. Must be 32 random bytes, base64. */
export function parseKey(raw: string | undefined): Buffer {
  if (!raw || !raw.trim()) throw new Error("DOCUMENT_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new Error(
      "DOCUMENT_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (generate one with: openssl rand -base64 32)."
    );
  }
  return key;
}

/** True when the bytes look like one of our encrypted envelopes. */
export function isEncryptedDocument(buf: Uint8Array): boolean {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  return (
    b.length >= HEADER_LEN + TAG_LEN &&
    b.subarray(0, MAGIC.length).equals(MAGIC) &&
    b[MAGIC.length] === VERSION
  );
}

export function encryptDocument(data: Uint8Array, meta: DocMeta, key: Buffer): Buffer {
  const metaBytes = Buffer.from(JSON.stringify({ name: meta.name, type: meta.type }), "utf8");
  if (metaBytes.length > MAX_META_BYTES) throw new Error("Document metadata too large.");
  const lenPrefix = Buffer.alloc(4);
  lenPrefix.writeUInt32BE(metaBytes.length);
  const plaintext = Buffer.concat([lenPrefix, metaBytes, Buffer.from(data)]);

  const aad = Buffer.concat([MAGIC, Buffer.from([VERSION])]);
  const iv = randomBytes(IV_LEN); // a fresh random IV for every document
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([aad, iv, ciphertext, cipher.getAuthTag()]);
}

/** Throws if the key is wrong or ANY byte was altered. */
export function decryptDocument(blob: Uint8Array, key: Buffer): { data: Buffer; meta: DocMeta } {
  if (!isEncryptedDocument(blob)) throw new Error("Not an encrypted document.");
  const b = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);

  const aad = b.subarray(0, AAD_LEN);
  const iv = b.subarray(AAD_LEN, HEADER_LEN);
  const tag = b.subarray(b.length - TAG_LEN);
  const ciphertext = b.subarray(HEADER_LEN, b.length - TAG_LEN);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  if (plaintext.length < 4) throw new Error("Corrupt document.");
  const metaLen = plaintext.readUInt32BE(0);
  if (metaLen > MAX_META_BYTES || 4 + metaLen > plaintext.length) throw new Error("Corrupt document header.");

  const parsed = JSON.parse(plaintext.subarray(4, 4 + metaLen).toString("utf8"));
  if (typeof parsed?.name !== "string" || typeof parsed?.type !== "string") {
    throw new Error("Corrupt document header.");
  }
  return { data: plaintext.subarray(4 + metaLen), meta: { name: parsed.name, type: parsed.type } };
}
