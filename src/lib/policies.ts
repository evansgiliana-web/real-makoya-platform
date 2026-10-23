/**
 * Security policy rules, written as plain functions with NO imports so they can
 * be unit-tested without a database or a running server
 * (run `npx tsx tests/policies.test.ts`).
 *
 * Routes stay thin: they load the data, call one of these, and act on the answer.
 */

export type RoleName = "SUPER_ADMIN" | "ADMIN" | "FIELD_AGENT" | "CLIENT";
export type AssessmentStatusName = "DRAFT" | "SUBMITTED" | "REVIEWED" | "FLAGGED";

// ─────────────────────────────────────────────────────────────
// Passwords
// ─────────────────────────────────────────────────────────────

const BANNED_FRAGMENTS = [
  "password",
  "changeme",
  "qwerty",
  "letmein",
  "welcome",
  "outlook@001",
  "123456",
  "realmakoya",
];

/** Returns a human-readable problem, or null when the password is acceptable. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 128) return "Password must be 128 characters or fewer.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain at least one letter and one number.";
  }
  const lower = pw.toLowerCase();
  if (BANNED_FRAGMENTS.some((f) => lower.includes(f))) {
    return "Password is too easy to guess. Avoid common words and the company name.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Login throttling
// ─────────────────────────────────────────────────────────────

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;

export function isLoginLocked(failuresInWindow: number): boolean {
  return failuresInWindow >= LOGIN_MAX_FAILURES;
}

// ─────────────────────────────────────────────────────────────
// Who may change which user account
// ─────────────────────────────────────────────────────────────

export type PolicyResult = { ok: true } | { ok: false; status: number; error: string };

export function checkUserChange(args: {
  actor: { id: string; role: RoleName };
  target: { id: string; role: RoleName; active: boolean };
  change: { role?: RoleName; active?: boolean };
  /** Number of ACTIVE Super Admin accounts right now. */
  activeSuperAdmins: number;
}): PolicyResult {
  const { actor, target, change, activeSuperAdmins } = args;
  const deny = (status: number, error: string): PolicyResult => ({ ok: false, status, error });

  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    return deny(403, "Forbidden");
  }
  if (actor.id === target.id) {
    return deny(400, "You cannot change your own account here.");
  }
  if (change.role === undefined && change.active === undefined) {
    return deny(400, "Nothing to change.");
  }

  // Admin and Super Admin accounts can only be touched by a Super Admin.
  if ((target.role === "SUPER_ADMIN" || target.role === "ADMIN") && actor.role !== "SUPER_ADMIN") {
    return deny(403, "Only a Super Admin can change Admin or Super Admin accounts.");
  }

  if (change.role !== undefined) {
    // FMCG logins live under Organizations; converting them to or from staff
    // would leave orphaned organization memberships.
    if (change.role === "CLIENT" || target.role === "CLIENT") {
      return deny(400, "FMCG client logins are managed under Organizations, not here.");
    }
    if ((change.role === "ADMIN" || change.role === "SUPER_ADMIN") && actor.role !== "SUPER_ADMIN") {
      return deny(403, "Only a Super Admin can grant Admin or Super Admin access.");
    }
  }

  // Never allow the platform to be left with no active Super Admin.
  const losingSuperAdmin =
    target.role === "SUPER_ADMIN" &&
    target.active &&
    (change.active === false || (change.role !== undefined && change.role !== "SUPER_ADMIN"));
  if (losingSuperAdmin && activeSuperAdmins <= 1) {
    return deny(400, "At least one active Super Admin must remain.");
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Assessment QA gate
// ─────────────────────────────────────────────────────────────

/** Admins may edit any assessment. Field agents may only edit their own. */
export function canEditAssessment(role: RoleName, actorId: string, assessmentAgentId: string): boolean {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (role === "FIELD_AGENT") return actorId === assessmentAgentId;
  return false;
}

/**
 * What status an assessment gets after an ordinary edit.
 *
 * The rule that protects clients: an edit ALWAYS sends the assessment back for
 * review. Only a reviewer who explicitly saves it as REVIEWED/FLAGGED keeps
 * (or sets) a reviewed state. Anyone else's edit cannot leave approved data
 * sitting in a client report without a fresh look.
 */
export function resolveEditedStatus(args: {
  actorCanReview: boolean;
  requested?: AssessmentStatusName;
}): { status: AssessmentStatusName; recordReviewer: boolean } {
  const { actorCanReview, requested } = args;
  if (actorCanReview && (requested === "REVIEWED" || requested === "FLAGGED")) {
    return { status: requested, recordReviewer: true };
  }
  if (requested === "DRAFT") return { status: "DRAFT", recordReviewer: false };
  return { status: "SUBMITTED", recordReviewer: false };
}

// ─────────────────────────────────────────────────────────────
// Audit diff — record exactly which fields changed
// ─────────────────────────────────────────────────────────────

function normalise(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return "null";
  return JSON.stringify(v);
}

export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[]
): { before: Record<string, unknown>; after: Record<string, unknown>; changed: string[] } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const changed: string[] = [];
  for (const k of keys) {
    if (normalise(before[k]) !== normalise(after[k])) {
      changed.push(k);
      b[k] = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k] ?? null;
      a[k] = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k] ?? null;
    }
  }
  return { before: b, after: a, changed };
}

// ─────────────────────────────────────────────────────────────
// Owner documents (ID copies, consent forms, registration papers)
// ─────────────────────────────────────────────────────────────

/** URL segment -> the Store column that holds the stored file's link. */
export const OWNER_DOCUMENT_KINDS = {
  consent: "ownerConsentDocumentUrl",
  registration: "municipalRegistrationDocumentUrl",
  ownership: "ownershipDocumentUrl",
  license: "businessLicenseDocumentUrl",
} as const;

export type OwnerDocumentKind = keyof typeof OWNER_DOCUMENT_KINDS;
export type OwnerDocumentField = (typeof OWNER_DOCUMENT_KINDS)[OwnerDocumentKind];

export function isOwnerDocumentKind(value: string): value is OwnerDocumentKind {
  return Object.prototype.hasOwnProperty.call(OWNER_DOCUMENT_KINDS, value);
}

/**
 * Who may open a store's owner documents.
 * Admins: every store. Field agents: only stores they captured themselves,
 * so one agent can't browse other people's ID copies. FMCG clients: never.
 */
export function canViewOwnerDocuments(args: {
  role: RoleName;
  userId: string;
  storeCreatedById: string | null;
}): boolean {
  if (args.role === "SUPER_ADMIN" || args.role === "ADMIN") return true;
  if (args.role === "FIELD_AGENT") return args.storeCreatedById !== null && args.storeCreatedById === args.userId;
  return false;
}

/** A stored link must point at our own file storage, never an arbitrary site. */
export function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export const SENSITIVE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // hosting limit is ~4.5MB per request

const TYPE_ALIASES: Record<string, string> = { "image/jpg": "image/jpeg", "image/heif": "image/heic" };

export function checkSensitiveUpload(args: {
  declaredType: string;
  size: number;
  sniffedType: string | null;
}): { ok: true; type: string } | { ok: false; error: string } {
  if (args.size <= 0) return { ok: false, error: "The file is empty." };
  if (args.size > SENSITIVE_UPLOAD_MAX_BYTES) {
    return { ok: false, error: "Documents must be under 4MB. Try a lower-resolution photo or a smaller PDF." };
  }
  if (!args.sniffedType) {
    return { ok: false, error: "Only PDF, JPEG, PNG, WebP or HEIC files are accepted for documents." };
  }
  const declared = args.declaredType.toLowerCase();
  const normalised = TYPE_ALIASES[declared] ?? declared;
  if (declared && normalised !== args.sniffedType) {
    return { ok: false, error: "The file's contents don't match its file type." };
  }
  return { ok: true, type: args.sniffedType };
}

/** Types we are willing to display inline; anything else is forced to download. */
export const INLINE_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Content-Disposition header value that cannot be used for header injection:
 * quotes, slashes and control characters never reach the header.
 */
export function contentDisposition(disposition: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100) || "document";
  const encoded = encodeURIComponent(name.replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 100) || "document");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
