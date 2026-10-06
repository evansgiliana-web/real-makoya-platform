import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { can, ROLE_LABELS } from "@/lib/rbac";
import UserForm from "@/components/UserForm";
import UserRow from "@/components/UserRow";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "user:manage")) redirect("/dashboard");

  // Internal agency staff only — CLIENT (FMCG) logins now live under Organizations
  const users = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "FIELD_AGENT"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 mb-1">Users & Access</h1>
          <p className="text-sm text-gray-500">Internal agency staff logins.</p>
        </div>
        <Link href="/dashboard/organizations" className="btn-secondary text-sm">
          Manage FMCG Clients →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Add a Staff User</h2>
          <UserForm canCreateAdmins={session.user.role === "SUPER_ADMIN"} />
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Existing Staff ({users.length})</h2>
          <div className="divide-y divide-gray-100 -mx-2">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  active: u.active,
                  isSelf: u.id === session.user.id,
                }}
                roleLabel={ROLE_LABELS[u.role]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
