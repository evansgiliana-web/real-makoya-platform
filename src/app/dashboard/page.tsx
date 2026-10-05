import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { can } from "@/lib/rbac";

export default async function StoresPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/dashboard/reports");

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assessments: true } },
      assessments: { orderBy: { visitDate: "desc" }, take: 1, select: { counterfeitRisk: true } },
    },
  });

  const regStyles: Record<string, string> = {
    REGISTERED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    UNREGISTERED: "bg-red-100 text-red-700",
    UNKNOWN: "bg-gray-100 text-gray-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Stores</h1>
          <p className="text-sm text-gray-500">{stores.length} store(s) on file.</p>
        </div>
        <div className="flex gap-2">
          {can(session.user.role, "export:raw-data") && (
            <a href="/api/export/csv" className="btn-secondary">
              Export CSV
            </a>
          )}
          <Link href="/dashboard/stores/new" className="btn-primary">
            + Capture New Store
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Town / Province</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Assessments</th>
              <th className="px-4 py-3">Last Risk</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-brand-50/50">
                <td className="px-4 py-3 font-medium text-brand-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.town}, {s.province}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.ownerName}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${regStyles[s.municipalRegistrationStatus]}`}>
                    {s.municipalRegistrationStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{s._count.assessments}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.assessments[0]?.counterfeitRisk?.replace("_", " ") ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/stores/${s.id}`} className="text-brand-700 font-medium hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No stores captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
