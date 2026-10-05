import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import StoreMapClient from "@/components/StoreMapClient";
import { can } from "@/lib/rbac";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [secs, label] of units) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { period?: string; region?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/dashboard/reports");

  const period = searchParams.period || "ALL";
  const region = searchParams.region || "ALL";

  const [storeCount, assessmentCount, highRiskCount, unregisteredCount, regionsRaw] = await Promise.all([
    prisma.store.count(),
    prisma.assessment.count(),
    prisma.assessment.count({ where: { counterfeitRisk: { in: ["HIGH", "CONFIRMED_COUNTERFEIT"] } } }),
    prisma.store.count({ where: { municipalRegistrationStatus: { in: ["UNREGISTERED", "UNKNOWN"] } } }),
    prisma.store.findMany({ distinct: ["province"], select: { province: true } }),
  ]);
  const regions = regionsRaw.map((r) => r.province).sort();

  // All stores with their latest assessment, for the map + leaderboard
  const stores = await prisma.store.findMany({
    where: region !== "ALL" ? { province: region } : {},
    include: {
      assessments: { orderBy: { visitDate: "desc" }, take: 1 },
    },
  });

  const mapStores = stores.map((s) => ({
    id: s.id,
    name: s.name,
    town: s.town,
    province: s.province,
    latitude: s.latitude,
    longitude: s.longitude,
    riskLevel: s.assessments[0]?.counterfeitRisk,
  }));

  const leaderboard = stores
    .filter((s) => s.assessments[0]?.estimatedMonthlyTurnoverZar)
    .sort(
      (a, b) =>
        (b.assessments[0].estimatedMonthlyTurnoverZar || 0) - (a.assessments[0].estimatedMonthlyTurnoverZar || 0)
    )
    .slice(0, 5);
  const maxTurnover = leaderboard[0]?.assessments[0]?.estimatedMonthlyTurnoverZar || 1;

  // Recent activity feed: merge store-created + assessment-submitted events
  const periodCutoff =
    period === "WEEK"
      ? new Date(Date.now() - 7 * 86400000)
      : period === "MONTH"
      ? new Date(Date.now() - 30 * 86400000)
      : null;

  const [recentStores, recentAssessments] = await Promise.all([
    prisma.store.findMany({
      where: {
        ...(region !== "ALL" ? { province: region } : {}),
        ...(periodCutoff ? { createdAt: { gte: periodCutoff } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.assessment.findMany({
      where: {
        ...(region !== "ALL" ? { store: { province: region } } : {}),
        ...(periodCutoff ? { visitDate: { gte: periodCutoff } } : {}),
      },
      orderBy: { visitDate: "desc" },
      take: 10,
      include: { store: { select: { name: true } }, agent: { select: { name: true } } },
    }),
  ]);

  type Activity = { date: Date; icon: string; text: string };
  const activity: Activity[] = [
    ...recentStores.map((s) => ({
      date: s.createdAt,
      icon: "🏪",
      text: `New Store Captured: ${s.name} by ${s.createdBy.name}`,
    })),
    ...recentAssessments.map((a) => ({
      date: a.visitDate,
      icon: a.counterfeitRisk === "HIGH" || a.counterfeitRisk === "CONFIRMED_COUNTERFEIT" ? "⚠️" : "✅",
      text:
        a.counterfeitRisk === "HIGH" || a.counterfeitRisk === "CONFIRMED_COUNTERFEIT"
          ? `High Risk Alert: possible counterfeit at ${a.store.name}`
          : `Assessment Completed: ${a.store.name} by ${a.agent.name}`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const stats = [
    { label: "Stores Captured", value: storeCount, href: "/dashboard/stores", linkLabel: "View Stores" },
    { label: "Total Assessments", value: assessmentCount, href: "/dashboard/stores", linkLabel: "View Assessments" },
    {
      label: "Counterfeit Risks",
      value: highRiskCount,
      href: "/dashboard/stores",
      linkLabel: "View Risks",
      warn: true,
    },
    {
      label: "Unregistered Stores",
      value: unregisteredCount,
      href: "/dashboard/stores",
      linkLabel: "View Unregistered",
      warn: true,
    },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.warn && s.value > 0 ? "text-red-600" : "text-brand-900"}`}>
                {s.value}
              </p>
            </div>
            <Link href={s.href} className="text-xs font-medium text-brand-700 hover:underline mt-2">
              {s.linkLabel} →
            </Link>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-brand-900">Recent Activity</h2>
          <FilterBar regions={regions} />
        </div>
        <div className="divide-y divide-gray-100">
          {activity.length === 0 && (
            <p className="text-sm text-gray-500 py-4">No activity in this period/region yet.</p>
          )}
          {activity.map((a, i) => (
            <div key={i} className="py-3 flex items-center gap-3 text-sm">
              <span>{a.icon}</span>
              <span className="flex-1 text-gray-700">{a.text}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(a.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">Quick Insights</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/reports" className="btn-secondary text-sm">
            Client Report Preview
          </Link>
          <Link href="/dashboard/stores" className="btn-secondary text-sm">
            Full Store Directory
          </Link>
          {can(session.user.role, "export:raw-data") && (
            <a href="/api/export/csv" className="btn-secondary text-sm">
              Export Raw Data (CSV)
            </a>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-brand-900 mb-3">Store Locations</h2>
          <StoreMapClient stores={mapStores} />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-brand-900 mb-3">Top Performing Stores</h2>
          {leaderboard.length === 0 && (
            <p className="text-sm text-gray-500">
              No turnover data yet — capture an assessment with Commercial Metrics filled in.
            </p>
          )}
          <div className="space-y-3">
            {leaderboard.map((s, i) => {
              const turnover = s.assessments[0].estimatedMonthlyTurnoverZar || 0;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/stores/${s.id}`}
                  className="flex items-center gap-3 text-sm hover:bg-brand-50 -mx-2 px-2 py-1 rounded-lg"
                >
                  <span className="text-gray-400 w-4">{i + 1}.</span>
                  <span className="font-medium text-brand-900 w-32 truncate">{s.name}</span>
                  <div className="flex-1 bg-gray-100 rounded h-2">
                    <div
                      className="bg-brand-700 h-2 rounded"
                      style={{ width: `${(turnover / maxTurnover) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">R{turnover.toLocaleString()}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
