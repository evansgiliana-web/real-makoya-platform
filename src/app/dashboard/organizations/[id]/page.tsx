import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { can, ROLE_LABELS } from "@/lib/rbac";
import AddBrandForm from "@/components/AddBrandForm";
import InviteMemberForm from "@/components/InviteMemberForm";
import RemoveMemberButton from "@/components/RemoveMemberButton";

export default async function OrganizationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!can(session.user.role, "org:manage")) redirect("/dashboard");

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      brands: { orderBy: { name: "asc" } },
      memberships: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, active: true } } },
      },
    },
  });
  if (!org) notFound();

  const brandNameById = Object.fromEntries(org.brands.map((b) => [b.id, b.name]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">{org.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {org.brands.length} brand{org.brands.length === 1 ? "" : "s"} · {org.memberships.length} team
        member{org.memberships.length === 1 ? "" : "s"}
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-brand-900 mb-3">Brands</h2>
            <div className="space-y-1 mb-4">
              {org.brands.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                  <span>{b.name}</span>
                  <span className="text-xs text-gray-400">{b.category || "No category"}</span>
                </div>
              ))}
              {org.brands.length === 0 && <p className="text-sm text-gray-400">No brands yet.</p>}
            </div>
            <AddBrandForm organizationId={org.id} />
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-brand-900 mb-3">Add a Teammate</h2>
            <InviteMemberForm organizationId={org.id} brands={org.brands} />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Team</h2>
          <div className="divide-y divide-gray-100">
            {org.memberships.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-brand-900">
                    {m.user.name}{" "}
                    {!m.user.active && <span className="text-xs text-red-500">(deactivated)</span>}
                  </p>
                  <p className="text-gray-500">
                    {m.user.email} · {m.orgRole === "OWNER" ? "Owner" : "Member"}
                    {!m.allBrandsAccess &&
                      ` · ${m.brandIds.map((id) => brandNameById[id] || "?").join(", ") || "no brands"}`}
                  </p>
                </div>
                <RemoveMemberButton organizationId={org.id} membershipId={m.id} name={m.user.name} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
