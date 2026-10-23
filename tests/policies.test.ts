/**
 * Unit tests for the security rules in src/lib/policies.ts.
 * Run with:  npx tsx tests/policies.test.ts
 * (No test framework needed. Exits with code 1 if anything fails.)
 */
import assert from "node:assert/strict";
import {
  passwordProblem,
  isLoginLocked,
  LOGIN_MAX_FAILURES,
  checkUserChange,
  canEditAssessment,
  resolveEditedStatus,
  diffRecords,
  type RoleName,
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

// ── Passwords ────────────────────────────────────────────────
console.log("\nPasswords");
test("rejects short passwords", () => assert.ok(passwordProblem("Ab1xyz")));
test("rejects letters-only", () => assert.ok(passwordProblem("abcdefghijkl")));
test("rejects digits-only", () => assert.ok(passwordProblem("1234567890123")));
test("rejects the old seed fallback password", () => assert.ok(passwordProblem("Outlook@001")));
test("rejects common-word passwords", () => {
  assert.ok(passwordProblem("Password12345"));
  assert.ok(passwordProblem("ChangeMe12345!"));
});
test("rejects company-name passwords", () => assert.ok(passwordProblem("RealMakoya2026!")));
test("accepts a strong passphrase", () => assert.equal(passwordProblem("blue-Kettle-7-orbit"), null));
test("rejects absurdly long input", () => assert.ok(passwordProblem("a1".repeat(80))));

// ── Login lockout ────────────────────────────────────────────
console.log("\nLogin throttling");
test("not locked below the limit", () => assert.equal(isLoginLocked(LOGIN_MAX_FAILURES - 1), false));
test("locked at the limit", () => assert.equal(isLoginLocked(LOGIN_MAX_FAILURES), true));

// ── User administration ──────────────────────────────────────
console.log("\nUser administration");
const u = (id: string, role: RoleName, active = true) => ({ id, role, active });

test("Admin cannot deactivate a Super Admin", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("s", "SUPER_ADMIN"), change: { active: false }, activeSuperAdmins: 2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});
test("Admin cannot demote a Super Admin", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("s", "SUPER_ADMIN"), change: { role: "FIELD_AGENT" }, activeSuperAdmins: 2 });
  assert.equal(r.ok, false);
});
test("Admin cannot deactivate another Admin", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("b", "ADMIN"), change: { active: false }, activeSuperAdmins: 1 });
  assert.equal(r.ok, false);
});
test("Admin cannot promote an agent to Admin", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("f", "FIELD_AGENT"), change: { role: "ADMIN" }, activeSuperAdmins: 1 });
  assert.equal(r.ok, false);
});
test("Admin can deactivate a field agent", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("f", "FIELD_AGENT"), change: { active: false }, activeSuperAdmins: 1 });
  assert.equal(r.ok, true);
});
test("Admin can deactivate an FMCG client login", () => {
  const r = checkUserChange({ actor: u("a", "ADMIN"), target: u("c", "CLIENT"), change: { active: false }, activeSuperAdmins: 1 });
  assert.equal(r.ok, true);
});
test("nobody can turn a client into staff (or the reverse) here", () => {
  assert.equal(checkUserChange({ actor: u("s", "SUPER_ADMIN"), target: u("c", "CLIENT"), change: { role: "FIELD_AGENT" }, activeSuperAdmins: 2 }).ok, false);
  assert.equal(checkUserChange({ actor: u("s", "SUPER_ADMIN"), target: u("f", "FIELD_AGENT"), change: { role: "CLIENT" }, activeSuperAdmins: 2 }).ok, false);
});
test("Super Admin can promote an agent to Admin", () => {
  const r = checkUserChange({ actor: u("s", "SUPER_ADMIN"), target: u("f", "FIELD_AGENT"), change: { role: "ADMIN" }, activeSuperAdmins: 1 });
  assert.equal(r.ok, true);
});
test("cannot change your own account", () => {
  const r = checkUserChange({ actor: u("s", "SUPER_ADMIN"), target: u("s", "SUPER_ADMIN"), change: { active: false }, activeSuperAdmins: 2 });
  assert.equal(r.ok, false);
});
test("the last active Super Admin cannot be deactivated or demoted", () => {
  assert.equal(checkUserChange({ actor: u("s1", "SUPER_ADMIN"), target: u("s2", "SUPER_ADMIN"), change: { active: false }, activeSuperAdmins: 1 }).ok, false);
  assert.equal(checkUserChange({ actor: u("s1", "SUPER_ADMIN"), target: u("s2", "SUPER_ADMIN"), change: { role: "ADMIN" }, activeSuperAdmins: 1 }).ok, false);
});
test("a Super Admin can be deactivated when another remains", () => {
  assert.equal(checkUserChange({ actor: u("s1", "SUPER_ADMIN"), target: u("s2", "SUPER_ADMIN"), change: { active: false }, activeSuperAdmins: 2 }).ok, true);
});
test("an empty change is rejected", () => {
  assert.equal(checkUserChange({ actor: u("s", "SUPER_ADMIN"), target: u("f", "FIELD_AGENT"), change: {}, activeSuperAdmins: 2 }).ok, false);
});
test("field agents and clients are never allowed to manage users", () => {
  assert.equal(checkUserChange({ actor: u("f", "FIELD_AGENT"), target: u("g", "FIELD_AGENT"), change: { active: false }, activeSuperAdmins: 1 }).ok, false);
  assert.equal(checkUserChange({ actor: u("c", "CLIENT"), target: u("g", "FIELD_AGENT"), change: { active: false }, activeSuperAdmins: 1 }).ok, false);
});

// ── Assessment edit ownership ────────────────────────────────
console.log("\nAssessment editing");
test("agents can edit only their own assessments", () => {
  assert.equal(canEditAssessment("FIELD_AGENT", "agent1", "agent1"), true);
  assert.equal(canEditAssessment("FIELD_AGENT", "agent1", "agent2"), false);
});
test("admins can edit any assessment", () => {
  assert.equal(canEditAssessment("ADMIN", "x", "agent2"), true);
  assert.equal(canEditAssessment("SUPER_ADMIN", "x", "agent2"), true);
});
test("clients can never edit", () => assert.equal(canEditAssessment("CLIENT", "c", "c"), false));

// ── QA gate ──────────────────────────────────────────────────
console.log("\nQA gate");
test("an agent's edit sends the assessment back to SUBMITTED", () => {
  const r = resolveEditedStatus({ actorCanReview: false, requested: undefined });
  assert.deepEqual(r, { status: "SUBMITTED", recordReviewer: false });
});
test("an agent cannot smuggle REVIEWED or FLAGGED through an edit", () => {
  assert.equal(resolveEditedStatus({ actorCanReview: false, requested: "REVIEWED" }).status, "SUBMITTED");
  assert.equal(resolveEditedStatus({ actorCanReview: false, requested: "FLAGGED" }).status, "SUBMITTED");
});
test("an admin's plain edit also requires a fresh review", () => {
  assert.equal(resolveEditedStatus({ actorCanReview: true, requested: undefined }).status, "SUBMITTED");
});
test("an admin explicitly saving as REVIEWED records the reviewer", () => {
  assert.deepEqual(resolveEditedStatus({ actorCanReview: true, requested: "REVIEWED" }), { status: "REVIEWED", recordReviewer: true });
});
test("drafts stay drafts", () => assert.equal(resolveEditedStatus({ actorCanReview: false, requested: "DRAFT" }).status, "DRAFT"));

// ── Audit diff ───────────────────────────────────────────────
console.log("\nAudit diff");
test("records only the fields that changed", () => {
  const d = diffRecords(
    { turnover: 1000, risk: "LOW", note: null, when: new Date("2026-01-01T00:00:00Z") },
    { turnover: 9000, risk: "LOW", note: null, when: new Date("2026-01-01T00:00:00Z") },
    ["turnover", "risk", "note", "when"]
  );
  assert.deepEqual(d.changed, ["turnover"]);
  assert.deepEqual(d.before, { turnover: 1000 });
  assert.deepEqual(d.after, { turnover: 9000 });
});
test("treats undefined and null as the same, and compares arrays by value", () => {
  const d = diffRecords({ a: undefined, photos: ["x", "y"] }, { a: null, photos: ["x", "y"] }, ["a", "photos"]);
  assert.deepEqual(d.changed, []);
});
test("detects array and date changes", () => {
  const d = diffRecords(
    { photos: ["x"], when: new Date("2026-01-01T00:00:00Z") },
    { photos: ["x", "z"], when: new Date("2026-02-01T00:00:00Z") },
    ["photos", "when"]
  );
  assert.deepEqual(d.changed, ["photos", "when"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
