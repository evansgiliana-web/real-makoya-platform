import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/dashboard/reports");

  const [storeCount, assessmentCount, highRiskCount, unregisteredCount] = await Promise.all([
    prisma.store.count(),
    prisma.assessment.count(),
    prisma.assessment.count({ where: { counterfeitRisk: { in: ["HIGH", "CONFIRMED_COUNTERFEIT"] } } }),
    prisma.store.count({ where: { municipalRegistrationStatus: { in: ["UNREGISTERED", "UNKNOWN"] } } }),
  ]);

  const recentAssessments = await prisma.assessment.findMany({
    take: 6,
    orderBy: { visitDate: "desc" },
    include: { store: { select: { name: true, town: true } }, agent: { select: { name: true } } },
  });

  const stats = [
    { label: "Stores Captured", value: storeCount },
    { label: "Total Assessments", value: assessmentCount },
    { label: "High/Confirmed Counterfeit Risk", value: highRiskCount, warn: true },
    { label: "Unregistered / Unknown Status", value: unregisteredCount, warn: true },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Overview</h1>
          <p className="text-sm text-gray-500">Live snapshot of field capture activity.</p>
        </div>
        <Link href="/dashboard/stores/new" className="btn-primary">
          + Capture New Store
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn && s.value > 0 ? "text-red-600" : "text-brand-900"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-brand-900 mb-4">Recent Assessments</h2>
        <div className="divide-y divide-gray-100">
          {recentAssessments.length === 0 && (
            <p className="text-sm text-gray-500 py-4">
              No assessments captured yet. Start by adding a store.
            </p>
          )}
          {recentAssessments.map((a) => (
            <div key={a.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-brand-900">{a.store.name}</p>
                <p className="text-gray-500">
                  {a.store.town} · captured by {a.agent.name} ·{" "}
                  {a.visitDate.toISOString().slice(0, 10)}
                </p>
              </div>
              <RiskBadge risk={a.counterfeitRisk} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    NONE: "bg-green-100 text-green-700",
    LOW: "bg-yellow-100 text-yellow-700",
    MEDIUM: "bg-orange-100 text-orange-700",
    HIGH: "bg-red-100 text-red-700",
    CONFIRMED_COUNTERFEIT: "bg-red-600 text-white",
  };
  return <span className={`badge ${styles[risk] ?? "bg-gray-100 text-gray-700"}`}>{risk.replace("_", " ")}</span>;
}
