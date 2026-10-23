/**
 * End-to-end tests of the REAL upload and download route code, with the outside
 * world (login, database, audit log, file storage) replaced by in-memory fakes.
 *
 * Run with:  npx tsx --tsconfig tests/tsconfig.harness.json tests/routes.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.BLOB_READ_WRITE_TOKEN = "test-token";
process.env.DOCUMENT_ENCRYPTION_KEY = randomBytes(32).toString("base64");

import { NextRequest } from "next/server";
import { sessionState } from "next-auth";
import { stores } from "@/lib/prisma";
import { auditCalls } from "@/lib/audit";
import { blobs } from "@vercel/blob";
import { POST as upload } from "../src/app/api/upload/route";
import { GET as download } from "../src/app/api/stores/[id]/documents/[kind]/route";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}

const as = (role: string, id: string) => {
  sessionState.session = { user: { id, role, email: `${id}@test.local`, name: id } };
};
const loggedOut = () => { sessionState.session = null; };

// Serve downloads from the in-memory blob store.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const bytes = blobs.get(String(input));
  return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response("nope", { status: 404 });
}) as typeof fetch;

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("OWNER-ID-8001015009087 Thabo Nkosi")]);

function uploadReq(file: File, sensitive: boolean) {
  const form = new FormData();
  form.append("file", file);
  if (sensitive) form.append("sensitive", "true");
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: form });
}
const call = (kind: string, id = "store1") =>
  download(new NextRequest(`http://localhost/api/stores/${id}/documents/${kind}`), { params: { id, kind } });

async function main() {
  // ───────────────────────── Upload ─────────────────────────
  console.log("\nUpload route");
  await test("rejects anonymous uploads", async () => {
    loggedOut();
    assert.equal((await upload(uploadReq(new File([PDF], "a.pdf", { type: "application/pdf" }), true))).status, 401);
  });
  await test("FMCG clients cannot upload", async () => {
    as("CLIENT", "c1");
    assert.equal((await upload(uploadReq(new File([PDF], "a.pdf", { type: "application/pdf" }), true))).status, 403);
  });
  await test("a sensitive upload is stored ENCRYPTED: no plaintext, no file name, in storage", async () => {
    as("FIELD_AGENT", "agent1");
    blobs.clear();
    const res = await upload(uploadReq(new File([PDF], "thabo-nkosi-id.pdf", { type: "application/pdf" }), true));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.encrypted, true);
    const stored = blobs.get(body.url)!;
    assert.ok(stored, "blob was stored");
    const text = stored.toString("latin1");
    assert.ok(!text.includes("OWNER-ID") && !text.includes("Thabo") && !text.includes("%PDF"));
    assert.ok(!body.url.includes("thabo"), "the file name must not appear in the storage link");
    assert.ok(auditCalls.some((c) => c.action === "document.upload"));
  });
  await test("a sensitive 'PDF' that is really HTML is rejected before storage", async () => {
    as("FIELD_AGENT", "agent1");
    blobs.clear();
    const evil = new File([Buffer.from("<html><script>steal()</script></html>padding")], "x.pdf", { type: "application/pdf" });
    const res = await upload(uploadReq(evil, true));
    assert.equal(res.status, 400);
    assert.equal(blobs.size, 0);
  });
  await test("a sensitive image labelled as PDF is rejected (type mismatch)", async () => {
    as("FIELD_AGENT", "agent1");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    assert.equal((await upload(uploadReq(new File([png], "x.pdf", { type: "application/pdf" }), true))).status, 400);
  });
  await test("an oversize sensitive document is rejected", async () => {
    as("FIELD_AGENT", "agent1");
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4 * 1024 * 1024 + 10)]);
    assert.equal((await upload(uploadReq(new File([big], "big.pdf", { type: "application/pdf" }), true))).status, 400);
  });
  await test("sensitive upload fails safely (503) when no encryption key is configured", async () => {
    as("FIELD_AGENT", "agent1");
    const saved = process.env.DOCUMENT_ENCRYPTION_KEY;
    delete process.env.DOCUMENT_ENCRYPTION_KEY;
    blobs.clear();
    const res = await upload(uploadReq(new File([PDF], "a.pdf", { type: "application/pdf" }), true));
    process.env.DOCUMENT_ENCRYPTION_KEY = saved;
    assert.equal(res.status, 503);
    assert.equal(blobs.size, 0, "nothing may be stored unencrypted when the key is missing");
  });
  await test("ordinary photos still upload as before", async () => {
    as("FIELD_AGENT", "agent1");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const res = await upload(uploadReq(new File([png], "shelf.png", { type: "image/png" }), false));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).encrypted, undefined);
  });
  await test("SVG is refused even though it is an 'image/*'", async () => {
    as("FIELD_AGENT", "agent1");
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>'], "x.svg", { type: "image/svg+xml" });
    assert.equal((await upload(uploadReq(svg, false))).status, 400);
  });

  // ───────────────────────── Download ─────────────────────────
  console.log("\nDocument download route");
  // Store a real encrypted document through the real upload route.
  as("FIELD_AGENT", "agent1");
  blobs.clear();
  const up = await (await upload(uploadReq(new File([PDF], "owner-id.pdf", { type: "application/pdf" }), true))).json();
  stores.set("store1", {
    id: "store1",
    createdById: "agent1",
    ownerConsentDocumentUrl: null,
    municipalRegistrationDocumentUrl: null,
    ownershipDocumentUrl: up.url,
    businessLicenseDocumentUrl: null,
  });

  await test("anonymous request is refused", async () => {
    loggedOut();
    assert.equal((await call("ownership")).status, 401);
  });
  await test("an FMCG client can never open an owner document", async () => {
    as("CLIENT", "c1");
    assert.equal((await call("ownership")).status, 403);
  });
  await test("an unknown document kind is a 404", async () => {
    as("ADMIN", "admin1");
    assert.equal((await call("passwd")).status, 404);
    assert.equal((await call("__proto__")).status, 404);
  });
  await test("an unknown store is a 404", async () => {
    as("ADMIN", "admin1");
    assert.equal((await call("ownership", "nope")).status, 404);
  });
  await test("a store with no such document is a 404", async () => {
    as("ADMIN", "admin1");
    assert.equal((await call("consent")).status, 404);
  });
  await test("another agent cannot open a store they did not capture", async () => {
    as("FIELD_AGENT", "agent2");
    assert.equal((await call("ownership")).status, 403);
  });
  await test("an admin gets the original file back, decrypted, with safe headers", async () => {
    as("ADMIN", "admin1");
    auditCalls.length = 0;
    const res = await call("ownership");
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(PDF));
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    assert.match(res.headers.get("content-disposition") ?? "", /^inline; filename="owner-id\.pdf"/);
  });
  await test("every view is written to the audit log", async () => {
    const view = auditCalls.find((c) => c.action === "document.view");
    assert.ok(view, "no document.view audit entry");
    assert.equal(view!.entityId, "store1");
    assert.equal((view!.meta as { kind: string }).kind, "ownership");
  });
  await test("the agent who captured the store can open it", async () => {
    as("FIELD_AGENT", "agent1");
    assert.equal((await call("ownership")).status, 200);
  });
  await test("a tampered stored file is refused, never served", async () => {
    as("ADMIN", "admin1");
    const bytes = Buffer.from(blobs.get(up.url)!);
    bytes[bytes.length - 30] ^= 0x01;
    blobs.set(up.url, bytes);
    assert.equal((await call("ownership")).status, 500);
  });
  await test("a stored link that is NOT on our storage is never fetched", async () => {
    as("ADMIN", "admin1");
    let fetched = false;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => { fetched = true; return new Response("x"); }) as typeof fetch;
    stores.set("store2", { id: "store2", createdById: "agent1", ownershipDocumentUrl: "https://evil.example.com/steal.pdf" });
    const res = await call("ownership", "store2");
    globalThis.fetch = prev;
    assert.equal(res.status, 502);
    assert.equal(fetched, false);
  });
  await test("a legacy un-encrypted document is still access-controlled and served", async () => {
    const legacyUrl = "https://old1.public.blob.vercel-storage.com/real-makoya/u/legacy.pdf";
    blobs.set(legacyUrl, PDF);
    stores.set("store3", { id: "store3", createdById: "agent1", ownershipDocumentUrl: legacyUrl });
    as("CLIENT", "c1");
    assert.equal((await call("ownership", "store3")).status, 403);
    as("ADMIN", "admin1");
    const res = await call("ownership", "store3");
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(PDF));
  });
  await test("a missing encryption key fails closed on an encrypted file", async () => {
    as("ADMIN", "admin1");
    const saved = process.env.DOCUMENT_ENCRYPTION_KEY;
    delete process.env.DOCUMENT_ENCRYPTION_KEY;
    stores.set("store4", { id: "store4", createdById: "agent1", ownershipDocumentUrl: up.url });
    const fresh = await (async () => { process.env.DOCUMENT_ENCRYPTION_KEY = saved!; as("FIELD_AGENT", "agent1"); const r = await (await upload(uploadReq(new File([PDF], "z.pdf", { type: "application/pdf" }), true))).json(); delete process.env.DOCUMENT_ENCRYPTION_KEY; return r.url; })();
    stores.set("store4", { id: "store4", createdById: "agent1", ownershipDocumentUrl: fresh });
    as("ADMIN", "admin1");
    const res = await call("ownership", "store4");
    process.env.DOCUMENT_ENCRYPTION_KEY = saved;
    assert.equal(res.status, 500);
  });

  globalThis.fetch = realFetch;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main();
