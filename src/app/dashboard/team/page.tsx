import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isOrgOwner } from "@/lib/rbac";
import InviteMemberForm from "@/components/InviteMemberForm";
import RemoveMemberButton from "@/components/RemoveMemberButton";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/dashboard");

  const membership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          brands: { orderBy: { name: "asc" } },
          memberships: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, active: true } } },
          },
        },
      },
    },
  });

  if (!membership) {
    return (
      <div className="card p-6">
        <p className="text-sm text-gray-500">
          Your account isn't linked to an organization yet. Contact Real Makoya Agency for help.
        </p>
      </div>
    );
  }

  const org = membership.organization;
  const canManage = isOrgOwner(membership.orgRole);
  const brandNameById = Object.fromEntries(org.brands.map((b) => [b.id, b.name]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">{org.name} — Team</h1>
      <p className="text-sm text-gray-500 mb-6">
        {canManage
          ? "Add teammates and control which brands each person can see."
          : "Only an Owner on your team can add or remove teammates."}
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-brand-900 mb-4">Team Members</h2>
          <div className="divide-y divide-gray-100">
            {org.memberships.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-brand-900">
                    {m.user.name} {m.userId === session.user.id && <span className="text-xs text-gray-400">(you)</span>}
                  </p>
                  <p className="text-gray-500">
                    {m.user.email} · {m.orgRole === "OWNER" ? "Owner" : "Member"}
                    {!m.allBrandsAccess &&
                      ` · ${m.brandIds.map((id) => brandNameById[id] || "?").join(", ") || "no brands"}`}
                  </p>
                </div>
                {canManage && m.userId !== session.user.id && (
                  <RemoveMemberButton organizationId={org.id} membershipId={m.id} name={m.user.name} />
                )}
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="card p-6">
            <h2 className="font-semibold text-brand-900 mb-4">Add a Teammate</h2>
            <InviteMemberForm organizationId={org.id} brands={org.brands} />
          </div>
        )}
      </div>
    </div>
  );
}
