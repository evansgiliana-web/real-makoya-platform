/**
 * Tests for owner-document protection.
 * Run with:  npx tsx tests/documents.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptDocument, decryptDocument, isEncryptedDocument, parseKey } from "../src/lib/docCrypto";
import { sniffContentType } from "../src/lib/fileSniff";
import {
  canViewOwnerDocuments,
  isOurBlobUrl,
  isOwnerDocumentKind,
  checkSensitiveUpload,
  contentDisposition,
  OWNER_DOCUMENT_KINDS,
} from "../src/lib/policies";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}

const key = randomBytes(32);
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("SECRET-ID-NUMBER-8001015009087 Thabo Nkosi")]);

// ── Encryption ───────────────────────────────────────────────
console.log("\nEncryption");
test("round-trips a document with its name and type", () => {
  const enc = encryptDocument(pdf, { name: "id-copy.pdf", type: "application/pdf" }, key);
  const dec = decryptDocument(enc, key);
  assert.ok(dec.data.equals(pdf));
  assert.deepEqual(dec.meta, { name: "id-copy.pdf", type: "application/pdf" });
});
test("the stored bytes contain none of the plaintext or the file name", () => {
  const enc = encryptDocument(pdf, { name: "thabo-nkosi-id.pdf", type: "application/pdf" }, key);
  const text = enc.toString("latin1");
  assert.ok(!text.includes("SECRET-ID-NUMBER"));
  assert.ok(!text.includes("Thabo"));
  assert.ok(!text.includes("thabo-nkosi-id"));
  assert.ok(!text.includes("%PDF"));
});
test("uses a fresh random IV each time (same file encrypts differently)", () => {
  const a = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  const b = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  assert.ok(!a.equals(b));
});
test("the wrong key cannot decrypt", () => {
  const enc = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  assert.throws(() => decryptDocument(enc, randomBytes(32)));
});
test("altering ANY single byte is detected", () => {
  const enc = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  for (const pos of [0, 4, 5, 10, 20, Math.floor(enc.length / 2), enc.length - 20, enc.length - 1]) {
    const tampered = Buffer.from(enc);
    tampered[pos] ^= 0x01;
    assert.throws(() => decryptDocument(tampered, key), `byte ${pos} change not detected`);
  }
});
test("a truncated blob is rejected", () => {
  const enc = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  assert.throws(() => decryptDocument(enc.subarray(0, enc.length - 5), key));
});
test("handles unicode names and a 4MB file", () => {
  const big = randomBytes(4 * 1024 * 1024);
  const enc = encryptDocument(big, { name: "ID — Nkosi ñ 名前.pdf", type: "application/pdf" }, key);
  const dec = decryptDocument(enc, key);
  assert.ok(dec.data.equals(big));
  assert.equal(dec.meta.name, "ID — Nkosi ñ 名前.pdf");
});
test("recognises its own envelope and nothing else", () => {
  const enc = encryptDocument(pdf, { name: "a.pdf", type: "application/pdf" }, key);
  assert.equal(isEncryptedDocument(enc), true);
  assert.equal(isEncryptedDocument(pdf), false);
  assert.equal(isEncryptedDocument(Buffer.alloc(0)), false);
});
test("accepts only a 32-byte base64 key", () => {
  assert.equal(parseKey(randomBytes(32).toString("base64")).length, 32);
  assert.throws(() => parseKey(undefined));
  assert.throws(() => parseKey(""));
  assert.throws(() => parseKey(randomBytes(16).toString("base64")));
  assert.throws(() => parseKey("not base64 at all!!"));
});

// ── File type by content ─────────────────────────────────────
console.log("\nFile type detection");
const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
test("recognises PDF, JPEG, PNG, WebP and HEIC by content", () => {
  assert.equal(sniffContentType(Buffer.from("%PDF-1.7\n1 0 obj")), "application/pdf");
  assert.equal(sniffContentType(pad([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffContentType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffContentType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])), "image/webp");
  assert.equal(sniffContentType(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic"), Buffer.alloc(8)])), "image/heic");
});
test("rejects HTML, scripts, SVG and executables pretending to be documents", () => {
  assert.equal(sniffContentType(Buffer.from("<!DOCTYPE html><script>alert(1)</script>")), null);
  assert.equal(sniffContentType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>')), null);
  assert.equal(sniffContentType(Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff")), null);
  assert.equal(sniffContentType(Buffer.from("short")), null);
});

// ── Upload validation ────────────────────────────────────────
console.log("\nSensitive upload checks");
test("accepts a genuine PDF", () =>
  assert.deepEqual(checkSensitiveUpload({ declaredType: "application/pdf", size: 1000, sniffedType: "application/pdf" }), { ok: true, type: "application/pdf" }));
test("accepts image/jpg and image/heif aliases", () => {
  assert.equal(checkSensitiveUpload({ declaredType: "image/jpg", size: 10, sniffedType: "image/jpeg" }).ok, true);
  assert.equal(checkSensitiveUpload({ declaredType: "image/heif", size: 10, sniffedType: "image/heic" }).ok, true);
});
test("rejects a file whose contents don't match its claimed type", () =>
  assert.equal(checkSensitiveUpload({ declaredType: "application/pdf", size: 100, sniffedType: "image/png" }).ok, false));
test("rejects unrecognised content", () =>
  assert.equal(checkSensitiveUpload({ declaredType: "application/pdf", size: 100, sniffedType: null }).ok, false));
test("rejects empty and oversize files", () => {
  assert.equal(checkSensitiveUpload({ declaredType: "application/pdf", size: 0, sniffedType: "application/pdf" }).ok, false);
  assert.equal(checkSensitiveUpload({ declaredType: "application/pdf", size: 4 * 1024 * 1024 + 1, sniffedType: "application/pdf" }).ok, false);
});

// ── Who may open documents ───────────────────────────────────
console.log("\nDocument access");
test("admins can open any store's documents", () => {
  assert.equal(canViewOwnerDocuments({ role: "ADMIN", userId: "a", storeCreatedById: "x" }), true);
  assert.equal(canViewOwnerDocuments({ role: "SUPER_ADMIN", userId: "a", storeCreatedById: "x" }), true);
});
test("an agent can open only documents for stores they captured", () => {
  assert.equal(canViewOwnerDocuments({ role: "FIELD_AGENT", userId: "a1", storeCreatedById: "a1" }), true);
  assert.equal(canViewOwnerDocuments({ role: "FIELD_AGENT", userId: "a1", storeCreatedById: "a2" }), false);
  assert.equal(canViewOwnerDocuments({ role: "FIELD_AGENT", userId: "a1", storeCreatedById: null }), false);
});
test("FMCG clients can never open owner documents", () =>
  assert.equal(canViewOwnerDocuments({ role: "CLIENT", userId: "c", storeCreatedById: "c" }), false));
test("only the four known document kinds are accepted", () => {
  for (const k of Object.keys(OWNER_DOCUMENT_KINDS)) assert.equal(isOwnerDocumentKind(k), true);
  for (const bad of ["", "passwd", "__proto__", "constructor", "ownership/../x", "OWNERSHIP"]) {
    assert.equal(isOwnerDocumentKind(bad), false, bad);
  }
});

// ── Stored-link safety ───────────────────────────────────────
console.log("\nStorage link safety");
test("accepts our storage host only", () => {
  assert.equal(isOurBlobUrl("https://abc123.public.blob.vercel-storage.com/private-docs/u/doc-x.bin"), true);
});
test("rejects other sites, http, and look-alike hosts", () => {
  for (const u of [
    "https://evil.example.com/file.pdf",
    "http://abc.public.blob.vercel-storage.com/x",
    "https://public.blob.vercel-storage.com.evil.com/x",
    "https://evil.com/.public.blob.vercel-storage.com",
    "javascript:alert(1)",
    "not a url",
    "",
  ]) assert.equal(isOurBlobUrl(u), false, u);
});

// ── Download header safety ───────────────────────────────────
console.log("\nDownload headers");
test("a hostile file name cannot inject headers or break quoting", () => {
  const h = contentDisposition("inline", 'evil".pdf\r\nSet-Cookie: x=1');
  assert.ok(!/[\r\n]/.test(h));
  assert.ok(!h.includes('evil"'));
  assert.ok(h.startsWith("inline; filename=\""));
});
test("falls back to a safe name", () => assert.match(contentDisposition("attachment", ""), /filename="document"/));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
