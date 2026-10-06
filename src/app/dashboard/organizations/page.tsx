import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { can } from "@/lib/rbac";
import OrgCreateForm from "@/components/OrgCreateForm";

export default async function OrganizationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "org:manage")) redirect("/dashboard");

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      brands: { select: { id: true, name: true } },
      memberships: { select: { id: true, orgRole: true, user: { select: { name: true, active: true } } } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">FMCG Organizations</h1>
      <p className="text-sm text-gray-500 mb-6">
        Onboard a client company, their brands, and their first team login.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Onboard a New Client</h2>
          <OrgCreateForm />
        </div>

        <div className="space-y-3">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/dashboard/organizations/${org.id}`}
              className="card p-4 flex items-center justify-between hover:bg-brand-50/50 block"
            >
              <div>
                <p className="font-medium text-brand-900">{org.name}</p>
                <p className="text-xs text-gray-500">
                  {org.brands.map((b) => b.name).join(", ") || "No brands yet"} ·{" "}
                  {org.memberships.length} team member{org.memberships.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-brand-700 text-sm font-medium">View →</span>
            </Link>
          ))}
          {organizations.length === 0 && (
            <p className="text-sm text-gray-500 card p-6">No FMCG organizations yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
