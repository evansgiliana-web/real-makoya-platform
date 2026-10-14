import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | string | null;
  action: string;
  entityType: "Store" | "Assessment" | "User" | string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

/**
 * Append-only audit trail. Never update or delete rows from AuditLog.
 * Call this after every create / update / review / redact action.
 */
export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ? String(input.actorRole) : null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.before != null ? JSON.stringify(input.before) : null,
        afterJson: input.after != null ? JSON.stringify(input.after) : null,
        metaJson: input.meta != null ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (err) {
    // Audit must never break the main request. Log and continue.
    console.error("[audit] failed to write log", err);
  }
}
