import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

function formatZar(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isClient = session.user.role === "CLIENT";
  let brandFilter: string[] | null = null;
  let clientCompany: string | null = null;

  if (isClient) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brandAccess: true },
    });
    if (user) {
      clientCompany = user.companyName;
      if (!user.allBrandsAccess) {
        brandFilter = user.brandAccess.map((b) => b.brandName);
      }
    }
  }

  const assessments = await prisma.assessment.findMany({
    include: {
      store: {
        select: {
          id: true,
          name: true,
          tradingAs: true,
          address: true,
          town: true,
          province: true,
          ownerName: true,
          ownerContactNumber: true,
          storeTelephoneNumber: true,
          municipalRegistrationStatus: true,
        },
      },
      productLines: brandFilter ? { where: { brand: { in: brandFilter } } } : true,
    },
    orderBy: { visitDate: "desc" },
  });

  const scoped = brandFilter
    ? assessments.filter((a) => a.productLines.length > 0)
    : assessments;

  const totalStores = new Set(scoped.map((a) => a.storeId)).size;
  const coaValidPct = pct(scoped.filter((a) => a.hasValidCoA).length, scoped.length);
  const healthPermitPct = pct(scoped.filter((a) => a.hasHealthPermit).length, scoped.length);
  const authenticPct = pct(
    scoped.filter((a) => a.brandAuthenticityVerified).length,
    scoped.length
  );

  const latestByStore = new Map<string, (typeof scoped)[number]>();
  for (const a of scoped) {
    if (!latestByStore.has(a.storeId)) latestByStore.set(a.storeId, a);
  }
  const latestAssessments: any[] = Array.from(latestByStore.values());

  const getSkuCount = (assessment: { totalSkuCount?: number | null; productLines?: { id: string }[] | null }) =>
    typeof assessment?.totalSkuCount === "number"
      ? assessment.totalSkuCount
      : Array.isArray(assessment?.productLines)
        ? assessment.productLines.length
        : 0;

  let totalSku = 0;
  let storesWithSku = 0;
  let totalTurnover = 0;
  let storesWithTurnover = 0;
  let totalTrackedUnits = 0;
  let totalTrackedTurnover = 0;

  for (const a of latestAssessments) {
    const skuCount = getSkuCount(a as any);
    if (skuCount > 0) {
      totalSku += skuCount;
      storesWithSku++;
    }
    if (a.estimatedMonthlyTurnoverZar != null && a.estimatedMonthlyTurnoverZar > 0) {
      totalTurnover += a.estimatedMonthlyTurnoverZar;
      storesWithTurnover++;
    }
  }

  for (const a of scoped) {
    for (const p of a.productLines) {
      const product = p as typeof p & {
        estimatedMonthlyUnits?: number | null;
        estimatedUnitPriceZar?: number | null;
      };
      const units = product.estimatedMonthlyUnits || 0;
      totalTrackedUnits += units;
      if (product.estimatedUnitPriceZar != null && units > 0) {
        totalTrackedTurnover += units * product.estimatedUnitPriceZar;
      }
    }
  }

  const avgSkuPerStore = storesWithSku > 0 ? Math.round(totalSku / storesWithSku) : 0;
  const avgTurnoverPerStore =
    storesWithTurnover > 0 ? Math.round(totalTurnover / storesWithTurnover) : 0;

  const posPct = pct(
    scoped.filter((a) => Boolean((a as any).posInstalled)).length,
    scoped.length
  );
  const scannerPct = pct(
    scoped.filter((a) => Boolean((a as any).scannerInstalled)).length,
    scoped.length
  );

  const riskCounts: Record<string, number> = {
    NONE: 0,
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CONFIRMED_COUNTERFEIT: 0,
  };
  const sourceCounts: Record<string, number> = {
    FORMAL_WHOLESALER: 0,
    INFORMAL_BULK_BUYER: 0,
    UNVERIFIED_SUPPLIER: 0,
    MIXED: 0,
  };
  const connectivityCounts: Record<string, number> = {
    NONE: 0,
    MOBILE_DATA: 0,
    WIFI: 0,
    FIBER: 0,
    UNKNOWN: 0,
  };
  const provinceCounts: Record<string, number> = {};
  const brandDemand: Record<string, number> = {};
  const categoryDemand: Record<string, number> = {};

  for (const a of scoped) {
    riskCounts[a.counterfeitRisk]++;
    sourceCounts[a.sourceType]++;
    const connectivity =
      (a as typeof a & { internetConnectivity?: keyof typeof connectivityCounts })
        .internetConnectivity ?? "UNKNOWN";
    connectivityCounts[connectivity]++;
    const prov = a.store.province || "Unknown";
    provinceCounts[prov] = (provinceCounts[prov] || 0) + 1;
    for (const p of a.productLines) {
      brandDemand[p.brand] = (brandDemand[p.brand] || 0) + (p.estimatedMonthlyUnits || 0);
      categoryDemand[p.category] =
        (categoryDemand[p.category] || 0) + (p.estimatedMonthlyUnits || 0);
    }
  }

  const topBrands = Object.entries(brandDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topCategories = Object.entries(categoryDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const directoryRows: any[] = latestAssessments;

  const highRiskTotal = riskCounts.HIGH + riskCounts.CONFIRMED_COUNTERFEIT;
  const formalSourcePct = pct(sourceCounts.FORMAL_WHOLESALER, scoped.length);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Market Intelligence Report</h1>
          <p className="text-sm text-gray-500">
            {isClient
              ? brandFilter
                ? `Scoped to: ${brandFilter.join(", ")}`
                : clientCompany
                  ? `${clientCompany} · Full market access`
                  : "Full market access"
              : "Preview of the report shared with FMCG clients"}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="card p-8 space-y-10">
        <header className="flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <div className="h-10 w-10 rounded-lg bg-accent-500 flex items-center justify-center text-brand-900 font-bold mb-2">
              RM
            </div>
            <h2 className="text-xl font-bold text-brand-900">Real Makoya Agency</h2>
            <p className="text-sm text-gray-500">
              Independent Retail Intelligence & Compliance Report
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Generated {new Date().toLocaleDateString("en-ZA")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {scoped.length} assessment{scoped.length === 1 ? "" : "s"} · {totalStores} store
              {totalStores === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        <section>
          <h3 className="font-semibold text-brand-900 mb-1">Executive Summary</h3>
          <p className="text-xs text-gray-500 mb-4">
            Compliance and authenticity indicators across assessed spaza retail outlets.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Stores Assessed" value={totalStores} />
            <Stat label="Valid CoA on File" value={`${coaValidPct}%`} />
            <Stat label="Health Permit Present" value={`${healthPermitPct}%`} />
            <Stat label="Brand Authenticity Verified" value={`${authenticPct}%`} />
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-brand-900 mb-1">Commercial Dashboard</h3>
          <p className="text-xs text-gray-500 mb-4">
            Store scale, SKU depth and estimated turnover from field assessments.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Total SKUs (on shelf)"
              value={totalSku > 0 ? totalSku.toLocaleString() : "—"}
              sub={
                storesWithSku > 0
                  ? `Avg ${avgSkuPerStore}/store`
                  : "Capture SKU counts in assessments"
              }
            />
            <Stat
              label="Est. Total Monthly Turnover"
              value={totalTurnover > 0 ? formatZar(totalTurnover) : "—"}
              sub={
                storesWithTurnover > 0
                  ? `Avg ${formatZar(avgTurnoverPerStore)}/store`
                  : "Capture turnover in assessments"
              }
            />
            <Stat
              label="Tracked Brand Volume"
              value={
                totalTrackedUnits > 0
                  ? `${totalTrackedUnits.toLocaleString()} units/mo`
                  : "—"
              }
              sub={
                totalTrackedTurnover > 0
                  ? `≈ ${formatZar(totalTrackedTurnover)} (priced lines)`
                  : "From product-line units"
              }
            />
            <Stat
              label="POS Systems Installed"
              value={`${posPct}%`}
              sub={`Scanner present: ${scannerPct}%`}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Stat
              label="Formal Wholesaler Source"
              value={`${formalSourcePct}%`}
              sub="Preferred distribution channel"
            />
            <Stat
              label="High / Confirmed Risk"
              value={highRiskTotal}
              warn={highRiskTotal > 0}
              sub="Stores needing priority review"
            />
            <Stat
              label="Product Lines Logged"
              value={Object.keys(brandDemand).length}
              sub={`${topCategories.length} categories represented`}
            />
            <Stat
              label="Provinces Covered"
              value={Object.keys(provinceCounts).length}
              sub={
                Object.entries(provinceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([p, c]) => `${p} (${c})`)
                  .join(" · ") || "—"
              }
            />
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-brand-900 mb-4">
            Store Directory ({directoryRows.length})
          </h3>
          {directoryRows.length === 0 && (
            <p className="text-sm text-gray-500">No stores to show yet.</p>
          )}
          {directoryRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="py-2 pr-3">Shop Name</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">SKUs</th>
                    <th className="py-2 pr-3">Est. Turnover/mo</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Registration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {directoryRows.map((a) => (
                    <tr key={a.store.id}>
                      <td className="py-2.5 pr-3 font-medium text-brand-900">
                        {a.store.name}
                        {a.store.tradingAs ? (
                          <span className="text-gray-400 font-normal">
                            {" "}
                            (t/a {a.store.tradingAs})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {a.store.town}, {a.store.province}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700 tabular-nums">
                        {getSkuCount(a as any) > 0 ? getSkuCount(a as any).toLocaleString() : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700 tabular-nums">
                        {a.estimatedMonthlyTurnoverZar != null
                          ? formatZar(a.estimatedMonthlyTurnoverZar)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <RiskPill risk={a.counterfeitRisk} />
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 text-xs">
                        {a.sourceType.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 text-xs">
                        {a.store.municipalRegistrationStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">
              Top-Selling Brands by Estimated Monthly Volume
            </h3>
            {topBrands.length === 0 && (
              <p className="text-sm text-gray-500">No product line data captured yet.</p>
            )}
            <div className="space-y-2">
              {topBrands.map(([brand, units], i) => (
                <div key={brand} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium w-36 truncate">{brand}</span>
                  <div className="flex-1 bg-gray-100 rounded h-2.5">
                    <div
                      className="bg-brand-700 h-2.5 rounded"
                      style={{
                        width: `${topBrands[0][1] ? (units / topBrands[0][1]) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {units.toLocaleString()} units/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Top Categories by Volume</h3>
            {topCategories.length === 0 && (
              <p className="text-sm text-gray-500">No category data captured yet.</p>
            )}
            <div className="space-y-2">
              {topCategories.map(([cat, units], i) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium w-36 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded h-2.5">
                    <div
                      className="bg-accent-500 h-2.5 rounded"
                      style={{
                        width: `${
                          topCategories[0][1] ? (units / topCategories[0][1]) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {units.toLocaleString()} units/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Counterfeit Risk Distribution</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(riskCounts).map(([risk, count]) => (
                <div key={risk} className="flex justify-between border-b border-gray-50 py-1.5">
                  <span className="text-gray-600">{risk.replace(/_/g, " ")}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Distribution Source Breakdown</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(sourceCounts).map(([source, count]) => (
                <div key={source} className="flex justify-between border-b border-gray-50 py-1.5">
                  <span className="text-gray-600">{source.replace(/_/g, " ")}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Internet Connectivity</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(connectivityCounts).map(([c, count]) => (
                <div key={c} className="flex justify-between border-b border-gray-50 py-1.5">
                  <span className="text-gray-600">{c.replace(/_/g, " ")}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {Object.keys(provinceCounts).length > 0 && (
          <section>
            <h3 className="font-semibold text-brand-900 mb-4">Geographic Coverage</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(provinceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([prov, count]) => (
                  <div
                    key={prov}
                    className="bg-brand-50 rounded-lg px-4 py-3 flex justify-between items-center"
                  >
                    <span className="text-sm text-brand-800">{prov}</span>
                    <span className="text-sm font-bold text-brand-900 tabular-nums">{count}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        <footer className="border-t border-gray-100 pt-4 text-xs text-gray-400 space-y-1">
          <p>
            This report is compiled from independent field assessments conducted by Real Makoya
            Agency and reflects observations at the time of each visit. It does not constitute a
            legal or regulatory determination.
          </p>
          <p>
            Turnover and SKU figures are field estimates provided by store operators or observed
            by agents; they are indicative only and should not be treated as audited financials.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-brand-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          warn && Number(value) > 0 ? "text-red-600" : "text-brand-900"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function RiskPill({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    NONE: "bg-green-100 text-green-800",
    LOW: "bg-yellow-100 text-yellow-800",
    MEDIUM: "bg-orange-100 text-orange-800",
    HIGH: "bg-red-100 text-red-800",
    CONFIRMED_COUNTERFEIT: "bg-red-600 text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        styles[risk] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {risk.replace(/_/g, " ")}
    </span>
  );
}
