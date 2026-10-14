import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import Link from "next/link";
import CreateOrgForm from "@/components/CreateOrgForm";

export default async function OrganisationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "org:manage")) redirect("/dashboard");

  const orgs = await prisma.organisation.findMany({
    orderBy: { name: "asc" },
    include: {
      brands: { where: { active: true }, orderBy: { name: "asc" } },
      departments: true,
      members: {
        where: { active: true },
        include: { user: { select: { name: true, email: true, role: true } } },
      },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">FMCG organisations</h1>
        <p className="text-sm text-gray-500">
          Companies, brands under each umbrella, and linked portal users.
        </p>
      </div>

      <CreateOrgForm />

      <div className="space-y-4">
        {orgs.length === 0 && (
          <p className="text-sm text-gray-500">No organisations yet. Create one above.</p>
        )}
        {orgs.map((org) => (
          <div key={org.id} className="card p-6">
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-brand-900">{org.name}</h2>
                <p className="text-xs text-gray-500">
                  {org.type} · {org._count.members} member
                  {org._count.members === 1 ? "" : "s"}
                  {org.website ? ` · ${org.website}` : ""}
                </p>
              </div>
            </div>
            <div className="mb-3">
              <p className="text-xs uppercase text-gray-400 mb-1">Brands</p>
              <div className="flex flex-wrap gap-2">
                {org.brands.map((b) => (
                  <span
                    key={b.id}
                    className="text-xs rounded-full bg-brand-50 text-brand-800 px-2.5 py-1"
                  >
                    {b.name}
                    {b.category ? ` (${b.category})` : ""}
                  </span>
                ))}
                {org.brands.length === 0 && (
                  <span className="text-sm text-gray-400">No brands</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400 mb-1">Members</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {org.members.map((m) => (
                  <li key={m.id}>
                    {m.user.name}{" "}
                    <span className="text-gray-400">
                      ({m.user.email}) · {m.roleInOrg.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
                {org.members.length === 0 && (
                  <li className="text-gray-400">
                    No members — create a CLIENT user then link them via seed or admin tools.
                  </li>
                )}
              </ul>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Portal:{" "}
              <Link href="/portal" className="text-brand-700 hover:underline">
                /portal
              </Link>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
