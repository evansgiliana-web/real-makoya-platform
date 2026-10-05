import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isClient = session.user.role === "CLIENT";
  let brandFilter: string[] | null = null;

  if (isClient) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brandAccess: true },
    });
    if (user && !user.allBrandsAccess) {
      brandFilter = user.brandAccess.map((b) => b.brandName);
    }
  }

  // Client reports only include REVIEWED assessments (QA gate).
  // Agency staff still see a pending-review notice below.
  const assessments = await prisma.assessment.findMany({
    where: isClient ? { status: "REVIEWED" } : undefined,
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

  const pendingReviewCount = isClient
    ? 0
    : await prisma.assessment.count({ where: { status: "SUBMITTED" } });

  // If brand-scoped, drop assessments that have zero matching product lines
  const scoped = brandFilter ? assessments.filter((a) => a.productLines.length > 0) : assessments;

  // For client metrics, only REVIEWED counts; for staff we show all but surface pending.
  const reportScoped = isClient
    ? scoped
    : scoped.filter((a) => a.status === "REVIEWED");
  const metricsSource = isClient ? scoped : reportScoped.length > 0 ? reportScoped : scoped;

  const totalStores = new Set(metricsSource.map((a) => a.storeId)).size;
  const coaValidPct = pct(metricsSource.filter((a) => a.hasValidCoA).length, metricsSource.length);
  const healthPermitPct = pct(metricsSource.filter((a) => a.hasHealthPermit).length, metricsSource.length);
  const authenticPct = pct(metricsSource.filter((a) => a.brandAuthenticityVerified).length, metricsSource.length);

  const riskCounts: Record<string, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CONFIRMED_COUNTERFEIT: 0 };
  const sourceCounts: Record<string, number> = {
    FORMAL_WHOLESALER: 0,
    INFORMAL_BULK_BUYER: 0,
    UNVERIFIED_SUPPLIER: 0,
    MIXED: 0,
  };
  const brandDemand: Record<string, number> = {};
  const brandRevenue: Record<string, number> = {};

  for (const a of scoped) {
    riskCounts[a.counterfeitRisk]++;
    sourceCounts[a.sourceType]++;
    for (const p of a.productLines) {
      const units = p.estimatedMonthlyUnits || 0;
      brandDemand[p.brand] = (brandDemand[p.brand] || 0) + units;
      if (p.estimatedUnitPriceZar) {
        brandRevenue[p.brand] = (brandRevenue[p.brand] || 0) + units * p.estimatedUnitPriceZar;
      }
    }
  }

  const topBrands = Object.entries(brandDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // One row per store, using its most recent (first, since sorted desc) assessment
  const storeDirectory = new Map<string, (typeof scoped)[number]>();
  for (const a of scoped) {
    if (!storeDirectory.has(a.storeId)) storeDirectory.set(a.storeId, a);
  }
  const directoryRows = Array.from(storeDirectory.values());

  // Store-level metrics (one per store, not per visit, to avoid double-counting)
  const totalMonthlyTurnover = directoryRows.reduce((sum, a) => sum + (a.estimatedMonthlyTurnoverZar || 0), 0);
  const totalSkus = directoryRows.reduce((sum, a) => sum + (a.totalSkuCount || 0), 0);

  return (
    <>
    {!isClient && pendingReviewCount > 0 && (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>{pendingReviewCount}</strong> assessment(s) are waiting for Admin review.
        Only <em>Reviewed</em> assessments appear in client-facing metrics and reports.
      </div>
    )}

    <div>
      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Market Intelligence Report</h1>
          <p className="text-sm text-gray-500">
            {isClient
              ? brandFilter
                ? `Scoped to: ${brandFilter.join(", ")}`
                : "Full market access"
              : "Preview of the report shared with FMCG clients"}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="card p-8 space-y-8">
        <header className="flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <div className="h-10 w-10 rounded-lg bg-accent-500 flex items-center justify-center text-brand-900 font-bold mb-2">
              RM
            </div>
            <h2 className="text-xl font-bold text-brand-900">Real Makoya Agency</h2>
            <p className="text-sm text-gray-500">Independent Retail Intelligence & Compliance Report</p>
          </div>
          <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString()}</p>
        </header>

        <section>
          <h3 className="font-semibold text-brand-900 mb-4">Executive Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Stat label="Stores Assessed" value={totalStores} />
            <Stat label="Valid CoA on File" value={`${coaValidPct}%`} />
            <Stat label="Health Permit Present" value={`${healthPermitPct}%`} />
            <Stat label="Brand Authenticity Verified" value={`${authenticPct}%`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Est. Combined Monthly Turnover" value={`R${totalMonthlyTurnover.toLocaleString()}`} />
            <Stat label="Total SKUs Across Stores" value={totalSkus.toLocaleString()} />
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-brand-900 mb-4">Store Directory ({directoryRows.length})</h3>
          {directoryRows.length === 0 && <p className="text-sm text-gray-500">No stores to show yet.</p>}
          {directoryRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="py-2 pr-4">Shop Name</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Contact</th>
                    <th className="py-2 pr-4">Registration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {directoryRows.map((a) => (
                    <tr key={a.store.id}>
                      <td className="py-2 pr-4 font-medium text-brand-900">
                        {a.store.name}
                        {a.store.tradingAs ? ` (t/a ${a.store.tradingAs})` : ""}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {a.store.address}, {a.store.town}, {a.store.province}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{a.store.ownerName}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {a.store.ownerContactNumber || a.store.storeTelephoneNumber || "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{a.store.municipalRegistrationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="font-semibold text-brand-900 mb-4">Top-Selling Brands by Estimated Monthly Volume</h3>
          {topBrands.length === 0 && <p className="text-sm text-gray-500">No product line data captured yet.</p>}
          <div className="space-y-2">
            {topBrands.map(([brand, units], i) => (
              <div key={brand} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                <span className="text-sm font-medium w-40 truncate">{brand}</span>
                <div className="flex-1 bg-gray-100 rounded h-2.5">
                  <div
                    className="bg-brand-700 h-2.5 rounded"
                    style={{ width: `${topBrands[0][1] ? (units / topBrands[0][1]) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-28 text-right">{units.toLocaleString()} units/mo</span>
                <span className="text-xs text-gray-400 w-28 text-right">
                  {brandRevenue[brand] ? `~R${Math.round(brandRevenue[brand]).toLocaleString()}/mo` : ""}
                </span>
              </div>
            ))}
          </div>
          {Object.keys(brandRevenue).length === 0 && (
            <p className="text-xs text-gray-400 mt-3">
              Add an average unit price per product line during capture to see estimated revenue here.
            </p>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Counterfeit Risk Distribution</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(riskCounts).map(([risk, count]) => (
                <div key={risk} className="flex justify-between border-b border-gray-50 py-1">
                  <span className="text-gray-600">{risk.replace("_", " ")}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brand-900 mb-4">Distribution Source Breakdown</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(sourceCounts).map(([source, count]) => (
                <div key={source} className="flex justify-between border-b border-gray-50 py-1">
                  <span className="text-gray-600">{source.replace(/_/g, " ")}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-gray-100 pt-4 text-xs text-gray-400">
          This report is compiled from independent field assessments conducted by Real Makoya
          Agency and reflects observations at the time of each visit. It does not constitute a
          legal or regulatory determination.
        </footer>
      </div>
    </div>
    </>
  );
}

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-brand-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-900">{value}</p>
    </div>
  );
}
