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

  const assessments = await prisma.assessment.findMany({
    include: {
      store: { select: { town: true, province: true, municipalRegistrationStatus: true } },
      productLines: brandFilter ? { where: { brand: { in: brandFilter } } } : true,
    },
    orderBy: { visitDate: "desc" },
  });

  // If brand-scoped, drop assessments that have zero matching product lines
  const scoped = brandFilter ? assessments.filter((a) => a.productLines.length > 0) : assessments;

  const totalStores = new Set(scoped.map((a) => a.storeId)).size;
  const coaValidPct = pct(scoped.filter((a) => a.hasValidCoA).length, scoped.length);
  const healthPermitPct = pct(scoped.filter((a) => a.hasHealthPermit).length, scoped.length);
  const authenticPct = pct(scoped.filter((a) => a.brandAuthenticityVerified).length, scoped.length);

  const riskCounts: Record<string, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CONFIRMED_COUNTERFEIT: 0 };
  const sourceCounts: Record<string, number> = {
    FORMAL_WHOLESALER: 0,
    INFORMAL_BULK_BUYER: 0,
    UNVERIFIED_SUPPLIER: 0,
    MIXED: 0,
  };
  const brandDemand: Record<string, number> = {};

  for (const a of scoped) {
    riskCounts[a.counterfeitRisk]++;
    sourceCounts[a.sourceType]++;
    for (const p of a.productLines) {
      brandDemand[p.brand] = (brandDemand[p.brand] || 0) + (p.estimatedMonthlyUnits || 0);
    }
  }

  const topBrands = Object.entries(brandDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Stores Assessed" value={totalStores} />
            <Stat label="Valid CoA on File" value={`${coaValidPct}%`} />
            <Stat label="Health Permit Present" value={`${healthPermitPct}%`} />
            <Stat label="Brand Authenticity Verified" value={`${authenticPct}%`} />
          </div>
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
                <span className="text-xs text-gray-500 w-24 text-right">{units.toLocaleString()} units/mo</span>
              </div>
            ))}
          </div>
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
