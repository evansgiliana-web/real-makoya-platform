import { Role } from "@prisma/client";

// Central place that defines what each role is allowed to do.
// Keep permission checks here rather than scattered through routes/pages
// so access rules stay auditable in one file.

export type Permission =
  | "store:create"
  | "store:edit"
  | "store:delete"
  | "store:redact-pii"
  | "assessment:create"
  | "assessment:edit"
  | "assessment:review" // Admin/Super Admin only — separation of duties
  | "user:manage"
  | "report:view"
  | "report:view-internal-notes"
  | "export:raw-data";

const PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "store:create",
    "store:edit",
    "store:delete",
    "store:redact-pii",
    "assessment:create",
    "assessment:edit",
    "assessment:review",
    "user:manage",
    "report:view",
    "report:view-internal-notes",
    "export:raw-data",
  ],
  ADMIN: [
    "store:create",
    "store:edit",
    "store:delete",
    "store:redact-pii",
    "assessment:create",
    "assessment:edit",
    "assessment:review",
    "user:manage",
    "report:view",
    "report:view-internal-notes",
    "export:raw-data",
  ],
  FIELD_AGENT: [
    "store:create",
    "store:edit",
    "assessment:create",
    "assessment:edit",
    "report:view",
  ],
  CLIENT: ["report:view"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error(`Role ${role} lacks permission ${permission}`);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Agency Admin",
  FIELD_AGENT: "Field Agent",
  CLIENT: "FMCG Client (read-only)",
};
