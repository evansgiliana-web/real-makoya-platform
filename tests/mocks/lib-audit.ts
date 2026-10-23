export const auditCalls: Record<string, unknown>[] = [];
export async function writeAuditLog(input: Record<string, unknown>) {
  auditCalls.push(input);
}
