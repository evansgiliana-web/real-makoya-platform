import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { can, ROLE_LABELS } from "@/lib/rbac";
import UserForm from "@/components/UserForm";
import UserRow from "@/components/UserRow";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "user:manage")) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { brandAccess: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">Users & Access</h1>
      <p className="text-sm text-gray-500 mb-6">
        Create logins and control what each person or client company can see.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Add a User</h2>
          <UserForm canCreateAdmins={session.user.role === "SUPER_ADMIN"} />
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Existing Users ({users.length})</h2>
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
                  companyName: u.companyName,
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
