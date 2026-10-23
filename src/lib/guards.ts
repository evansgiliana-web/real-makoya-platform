import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Server-side guard for agency-only pages (everything under /dashboard/stores).
 *
 * Call it at the top of every such page, not just in a layout: Next.js layouts
 * don't re-run on every client-side navigation, so a page that fetches
 * sensitive data must check access itself.
 *
 * FMCG (CLIENT) logins are sent to their reports; anonymous or deactivated
 * users are sent to the login page.
 */
export async function requireAgency() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/dashboard/reports");
  return session;
}
