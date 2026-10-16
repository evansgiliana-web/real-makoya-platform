import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import ExportProductsCsvButton from "@/components/ExportProductsCsvButton";
import StoreMapClient from "@/components/StoreMapClient";
import ReportFilters from "@/components/ReportFilters";
import VisitDocumentsList, { complianceDocsFromAssessment } from "@/components/VisitDocumentsList";
import PhotoGallery from "@/components/PhotoGallery";
import { sortImagesBySlot, slotLabel } from "@/lib/photoSlots";

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function matchesTurnover(
  value: number | null | undefined,
  band: string | undefined
): boolean {
  if (!band || band === "ALL") return true;
  if (band === "unknown") return value == null;
  if (value == null) return false;
  if (band === "0-20k") return value < 20000;
  if (band === "20k-50k") return value >= 20000 && value <= 50000;
  if (band === "50k+") return value > 50000;
  return true;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: {
    brand?: string;
    province?: string;
    storeId?: string;
    turnover?: string;
    view?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isClient = session.user.role === "CLIENT";
  let brandIdFilter: string[] | null = null;
  let orgBrands: { id: string; name: string }[] = [];
  let orgName = "";

  if (isClient) {
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { include: { brands: true } } },
    });

    if (!membership) {
      return (
        <div className="card p-6">
          <p className="text-sm text-gray-500">
            Your account isn&apos;t linked to an organization yet. Contact Real Makoya Agency for help.
          </p>
        </div>
      );
    }

    orgBrands = membership.organization.brands;
    orgName = membership.organization.name;

    const accessibleBrandIds = membership.allBrandsAccess
      ? orgBrands.map((b) => b.id)
      : membership.brandIds;

    const requested = searchParams.brand;
    brandIdFilter =
      requested && accessibleBrandIds.includes(requested)
        ? [requested]
        : accessibleBrandIds;
  }

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
          latitude: true,
          longitude: true,
          images: true,
        },
      },
      productLines: brandIdFilter
        ? { where: { brandId: { in: brandIdFilter } } }
        : true,
    },
    orderBy: { visitDate: "desc" },
  });

  const pendingReviewCount = isClient
    ? 0
    : await prisma.assessment.count({ where: { status: "SUBMITTED" } });

  let scoped = brandIdFilter
    ? assessments.filter((a) => a.productLines.length > 0)
    : assessments;

  // Region / store / turnover filters
  if (searchParams.province && searchParams.province !== "ALL") {
    scoped = scoped.filter((a) => a.store.province === searchParams.province);
  }
  if (searchParams.storeId && searchParams.storeId !== "ALL") {
    scoped = scoped.filter((a) => a.storeId === searchParams.storeId);
  }
  if (searchParams.turnover && searchParams.turnover !== "ALL") {
    scoped = scoped.filter((a) =>
      matchesTurnover(a.estimatedMonthlyTurnoverZar, searchParams.turnover)
    );
  }

  const reportScoped = isClient
    ? scoped
    : scoped.filter((a) => a.status === "REVIEWED");
  const metricsSource = isClient
    ? scoped
    : reportScoped.length > 0
      ? reportScoped
      : scoped;

  const totalStores = new Set(metricsSource.map((a) => a.storeId)).size;
  const coaCount = metricsSource.filter((a) => a.hasValidCoA).length;
  const healthPermitCount = metricsSource.filter((a) => a.hasHealthPermit).length;
  const coaValidPct = pct(coaCount, metricsSource.length);
  const healthPermitPct = pct(healthPermitCount, metricsSource.length);
  const authenticPct = pct(
    metricsSource.filter((a) => a.brandAuthenticityVerified).length,
    metricsSource.length
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
  const brandDemand: Record<string, number> = {};
  const brandRevenue: Record<string, number> = {};

  for (const a of scoped) {
    riskCounts[a.counterfeitRisk]++;
    sourceCounts[a.sourceType]++;
    for (const p of a.productLines) {
      const units = p.estimatedMonthlyUnits || 0;
      brandDemand[p.brand] = (brandDemand[p.brand] || 0) + units;
      if (p.estimatedUnitPriceZar) {
        brandRevenue[p.brand] =
          (brandRevenue[p.brand] || 0) + units * p.estimatedUnitPriceZar;
      }
    }
  }

  const topBrands = Object.entries(brandDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const storeDirectory = new Map<string, (typeof scoped)[number]>();
  for (const a of scoped) {
    if (!storeDirectory.has(a.storeId)) storeDirectory.set(a.storeId, a);
  }
  const directoryRows = Array.from(storeDirectory.values());

  const totalMonthlyTurnover = directoryRows.reduce(
    (sum, a) => sum + (a.estimatedMonthlyTurnoverZar || 0),
    0
  );
  const totalSkus = directoryRows.reduce(
    (sum, a) => sum + (a.totalSkuCount || 0),
    0
  );

  // Filter dropdown options from full client-scoped set (before region filters)
  // Re-use assessments after brand filter only for dropdown population
  const forOptions = brandIdFilter
    ? assessments.filter((a) => a.productLines.length > 0)
    : assessments;
  const optionDir = new Map<string, (typeof forOptions)[number]>();
  for (const a of forOptions) {
    if (!optionDir.has(a.storeId)) optionDir.set(a.storeId, a);
  }
  const allStoreOptions = Array.from(optionDir.values()).map((a) => ({
    id: a.store.id,
    name: a.store.name,
    town: a.store.town,
    province: a.store.province,
  }));
  const provinces = Array.from(
    new Set(allStoreOptions.map((s) => s.province))
  ).sort();


  // Phase 4 — product line detail rows (for combined + filters)
  type ProductRow = {
    storeName: string;
    town: string;
    province: string;
    brand: string;
    category: string;
    rank: number | null;
    units: number | null;
    unitPrice: number | null;
    lineValue: number | null;
    notes: string | null;
    visitDate: Date;
  };
  const productRows: ProductRow[] = [];
  for (const a of scoped) {
    for (const p of a.productLines) {
      const units = p.estimatedMonthlyUnits;
      const price = p.estimatedUnitPriceZar;
      productRows.push({
        storeName: a.store.name,
        town: a.store.town,
        province: a.store.province,
        brand: p.brand,
        category: p.category,
        rank: p.rank,
        units,
        unitPrice: price,
        lineValue:
          units != null && price != null ? units * price : null,
        notes: p.notes,
        visitDate: a.visitDate,
      });
    }
  }
  productRows.sort((a, b) => (b.lineValue || 0) - (a.lineValue || 0));

  // Labelled photos across stores in filter (cap for report size)
  const combinedPhotoItems: { url: string; label: string; category: string }[] = [];
  for (const a of directoryRows) {
    const imgs = sortImagesBySlot(a.store.images || []);
    for (const img of imgs) {
      combinedPhotoItems.push({
        url: img.url,
        label: `${a.store.name} — ${slotLabel(img.category)}`,
        category: img.category,
      });
    }
  }
  const photoPreview = combinedPhotoItems.slice(0, 24);


  const view = searchParams.view === "by-store" ? "by-store" : "combined";
  const singleStoreId =
    searchParams.storeId && searchParams.storeId !== "ALL"
      ? searchParams.storeId
      : null;
  const singleRow = singleStoreId
    ? directoryRows.find((a) => a.storeId === singleStoreId)
    : null;

  return (
    <>
      {!isClient && pendingReviewCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pendingReviewCount}</strong> assessment(s) waiting for Admin review. Only{" "}
          <em>Reviewed</em> assessments appear in client-facing metrics.
        </div>
      )}

      <div className="flex items-start justify-between mb-2 no-print flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Market Intelligence Report</h1>
          <p className="text-sm text-gray-500">
            {isClient
              ? `${orgName || "Your organization"} — filter by region, store, or turnover`
              : "Preview of the report shared with FMCG clients"}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <ExportProductsCsvButton />
          <PrintButton />
        </div>
      </div>

      <ReportFilters
        provinces={provinces}
        stores={allStoreOptions}
        showBrand={isClient && orgBrands.length > 1}
        brands={orgBrands}
        orgName={orgName}
      />

      {/* ── Single-store dossier ── */}
      {singleRow && (
        <div className="card p-8 mb-6 space-y-6">
          <header className="border-b border-gray-100 pb-4 flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Individual store report</p>
              <h2 className="text-xl font-bold text-brand-900">{singleRow.store.name}</h2>
              <p className="text-sm text-gray-500">
                {singleRow.store.address}, {singleRow.store.town}, {singleRow.store.province}
              </p>
            </div>
            <div className="text-sm text-gray-500 text-right">
              <p>Visit: {new Date(singleRow.visitDate).toLocaleDateString("en-ZA")}</p>
              <p>Status: {singleRow.status}</p>
            </div>
          </header>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Registration</dt>
              <dd className="font-medium">{singleRow.store.municipalRegistrationStatus}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Est. monthly turnover</dt>
              <dd className="font-medium">
                {singleRow.estimatedMonthlyTurnoverZar != null
                  ? `R${singleRow.estimatedMonthlyTurnoverZar.toLocaleString()}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">SKU count</dt>
              <dd className="font-medium">{singleRow.totalSkuCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Counterfeit risk</dt>
              <dd className="font-medium">{singleRow.counterfeitRisk.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Valid CoA</dt>
              <dd className="font-medium">{singleRow.hasValidCoA ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Health permit</dt>
              <dd className="font-medium">{singleRow.hasHealthPermit ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Authenticity verified</dt>
              <dd className="font-medium">
                {singleRow.brandAuthenticityVerified ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Supply source</dt>
              <dd className="font-medium">{singleRow.sourceType.replace(/_/g, " ")}</dd>
            </div>
            {!isClient && (
              <>
                <div>
                  <dt className="text-gray-500">Owner</dt>
                  <dd className="font-medium">{singleRow.store.ownerName}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Contact</dt>
                  <dd className="font-medium">
                    {singleRow.store.ownerContactNumber ||
                      singleRow.store.storeTelephoneNumber ||
                      "—"}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <section>
            <VisitDocumentsList
              title="Compliance documents (this visit)"
              docs={complianceDocsFromAssessment(singleRow)}
              emptyMessage="No CoA or health permit files uploaded for this visit."
            />
          </section>

          {singleRow.store.images?.length > 0 && (
            <section>
              <h3 className="font-semibold text-brand-900 mb-3">Store photos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {singleRow.store.images.map((img) => (
                  <div key={img.id}>
                    <p className="text-xs text-gray-500 mb-1">{img.category}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.category}
                      className="h-28 w-full object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold text-brand-900 mb-3">Product lines</h3>
            {singleRow.productLines.length === 0 ? (
              <p className="text-sm text-gray-500">No product lines in scope.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-gray-500 border-b">
                    <tr>
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 pr-3">Brand</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Est. units / month</th>
                      <th className="py-2 pr-3">Unit price</th>
                      <th className="py-2 pr-3">Line value</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {singleRow.productLines.map((p) => {
                      const line =
                        (p.estimatedMonthlyUnits || 0) *
                        (p.estimatedUnitPriceZar || 0);
                      return (
                        <tr key={p.id}>
                          <td className="py-2 pr-3">{p.rank ?? "—"}</td>
                          <td className="py-2 pr-3 font-medium">{p.brand}</td>
                          <td className="py-2 pr-3 text-gray-600">{p.category}</td>
                          <td className="py-2 pr-3">
                            {p.estimatedMonthlyUnits?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2 pr-3">
                            {p.estimatedUnitPriceZar != null
                              ? `R${p.estimatedUnitPriceZar.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            {line ? `R${line.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2 text-gray-600">{p.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-gray-400 no-print">
            Use <strong>Print</strong> to save this store report as PDF. Clear the Store filter for
            the portfolio view.
          </p>
        </div>
      )}

      {/* ── By-store cards (when not locked to one store) ── */}
      {!singleStoreId && view === "by-store" && (
        <div className="mb-6">
          <h2 className="font-semibold text-brand-900 mb-3">
            Stores in this filter ({directoryRows.length})
          </h2>
          {directoryRows.length === 0 && (
            <p className="text-sm text-gray-500 card p-6">No stores match these filters.</p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {directoryRows.map((a) => (
              <Link
                key={a.storeId}
                href={`/dashboard/reports?${new URLSearchParams({
                  ...(searchParams.brand ? { brand: searchParams.brand } : {}),
                  ...(searchParams.province ? { province: searchParams.province } : {}),
                  ...(searchParams.turnover ? { turnover: searchParams.turnover } : {}),
                  storeId: a.storeId,
                  view: "by-store",
                }).toString()}`}
                className="card-interactive p-5 block"
              >
                <p className="font-semibold text-brand-900">{a.store.name}</p>
                <p className="text-sm text-gray-500">
                  {a.store.town}, {a.store.province}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    Turnover:{" "}
                    <span className="font-medium text-brand-900">
                      {a.estimatedMonthlyTurnoverZar != null
                        ? `R${a.estimatedMonthlyTurnoverZar.toLocaleString()}`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    SKUs:{" "}
                    <span className="font-medium text-brand-900">
                      {a.totalSkuCount ?? "—"}
                    </span>
                  </div>
                  <div>
                    Risk:{" "}
                    <span className="font-medium">{a.counterfeitRisk.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-brand-700 font-medium">Full store report →</div>
                </dl>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Combined portfolio (default) ── */}
      {!singleStoreId && view === "combined" && (
        <div className="card p-8 space-y-8">
          <header className="flex items-center justify-between border-b border-gray-100 pb-6">
            <div>
              <div className="h-10 w-10 rounded-lg bg-accent-500 flex items-center justify-center text-brand-900 font-bold mb-2">
                RM
              </div>
              <h2 className="text-xl font-bold text-brand-900">Real Makoya Agency</h2>
              <p className="text-sm text-gray-500">
                Independent Retail Intelligence & Compliance Report
                {orgName ? ` — ${orgName}` : ""}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Generated {new Date().toLocaleDateString("en-ZA")}
            </p>
          </header>

          <section>
            <h3 className="font-semibold text-brand-900 mb-4">Executive Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Stat label="Stores Assessed" value={totalStores} />
              <Stat
                label="Valid CoA on File"
                value={`${coaCount} (${coaValidPct}%)`}
              />
              <Stat
                label="Health Permit Present"
                value={`${healthPermitCount} (${healthPermitPct}%)`}
              />
              <Stat label="Brand Authenticity Verified" value={`${authenticPct}%`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Est. Combined Monthly Turnover"
                value={`R${totalMonthlyTurnover.toLocaleString()}`}
              />
              <Stat label="Total SKUs Across Stores" value={totalSkus.toLocaleString()} />
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-brand-900 mb-3">
              Map of stores in this filter
            </h3>
            <StoreMapClient
              stores={directoryRows
                .filter((a) => a.store.latitude != null && a.store.longitude != null)
                .map((a) => ({
                  id: a.store.id,
                  name: a.store.name,
                  town: a.store.town,
                  province: a.store.province,
                  latitude: a.store.latitude,
                  longitude: a.store.longitude,
                }))}
              zoom={directoryRows.length === 1 ? 14 : 6}
            />
            {directoryRows.filter((a) => a.store.latitude == null).length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Some stores have no GPS coordinates and are omitted from the map.
              </p>
            )}
          </section>

          <section>
            <h3 className="font-semibold text-brand-900 mb-4">
              Store Directory ({directoryRows.length})
            </h3>
            {directoryRows.length === 0 && (
              <p className="text-sm text-gray-500">No stores match these filters.</p>
            )}
            {directoryRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="py-2 pr-4">Shop Name</th>
                      <th className="py-2 pr-4">Location</th>
                      {!isClient && <th className="py-2 pr-4">Owner</th>}
                      <th className="py-2 pr-4">Registration</th>
                      <th className="py-2 pr-4">Turnover</th>
                      <th className="py-2 pr-4 no-print"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {directoryRows.map((a) => (
                      <tr key={a.store.id} className="table-row-link">
                        <td className="py-2 pr-4 font-medium text-brand-900">
                          {a.store.name}
                          {a.store.tradingAs ? ` (t/a ${a.store.tradingAs})` : ""}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {a.store.town}, {a.store.province}
                        </td>
                        {!isClient && (
                          <td className="py-2 pr-4 text-gray-600">{a.store.ownerName}</td>
                        )}
                        <td className="py-2 pr-4 text-gray-600">
                          {a.store.municipalRegistrationStatus}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {a.estimatedMonthlyTurnoverZar != null
                            ? `R${a.estimatedMonthlyTurnoverZar.toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 no-print">
                          <Link
                            href={`/dashboard/reports?${new URLSearchParams({
                              ...(searchParams.brand ? { brand: searchParams.brand } : {}),
                              storeId: a.store.id,
                            }).toString()}`}
                            className="text-brand-700 font-medium hover:underline"
                          >
                            Store report →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="font-semibold text-brand-900 mb-4">
              Top-Selling Brands by Estimated Monthly Volume
            </h3>
            {topBrands.length === 0 && (
              <p className="text-sm text-gray-500">No product line data for this filter.</p>
            )}
            <div className="space-y-2">
              {topBrands.map(([brand, units], i) => (
                <div key={brand} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-brand-900 w-40 truncate">{brand}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full"
                      style={{
                        width: `${Math.min(100, (units / (topBrands[0][1] || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {units.toLocaleString()} u/mo
                  </span>
                  {brandRevenue[brand] != null && (
                    <span className="text-xs text-gray-500 w-24 text-right">
                      R{Math.round(brandRevenue[brand]).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-brand-900 mb-2">
              Product line detail ({productRows.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Estimated monthly movement by brand within the current filter. Line value =
              units × unit price where both were captured.
            </p>
            {productRows.length === 0 ? (
              <p className="text-sm text-gray-500">No product lines in this filter.</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="py-2 pr-3">Store</th>
                      <th className="py-2 pr-3">Location</th>
                      <th className="py-2 pr-3">Brand</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 pr-3">Units/mo</th>
                      <th className="py-2 pr-3">Unit price</th>
                      <th className="py-2 pr-3">Line value</th>
                      {!isClient && <th className="py-2">Notes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {productRows.map((row, i) => (
                      <tr key={`${row.storeName}-${row.brand}-${i}`} className="hover:bg-brand-50/40">
                        <td className="py-2 pr-3 font-medium text-brand-900">{row.storeName}</td>
                        <td className="py-2 pr-3 text-gray-600">
                          {row.town}, {row.province}
                        </td>
                        <td className="py-2 pr-3">{row.brand}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.category}</td>
                        <td className="py-2 pr-3">{row.rank ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {row.units != null ? row.units.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {row.unitPrice != null ? `R${row.unitPrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {row.lineValue != null
                            ? `R${Math.round(row.lineValue).toLocaleString()}`
                            : "—"}
                        </td>
                        {!isClient && (
                          <td className="py-2 text-gray-600 max-w-[12rem] truncate">
                            {row.notes || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="no-print">
            <PhotoGallery
              title={`Store visual audit (${photoPreview.length}${
                combinedPhotoItems.length > photoPreview.length
                  ? ` of ${combinedPhotoItems.length}`
                  : ""
              })`}
              items={photoPreview}
              emptyMessage="No labelled store photos in this filter yet."
            />
            {combinedPhotoItems.length > 24 && (
              <p className="text-xs text-gray-500 -mt-4 mb-4">
                Showing first 24 photos for performance. Narrow by province or store to see more
                per location, or open an individual store report.
              </p>
            )}
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-brand-900 mb-3">Counterfeit risk mix</h3>
              <ul className="text-sm space-y-1 text-gray-700">
                {Object.entries(riskCounts).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k.replace(/_/g, " ")}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-brand-900 mb-3">Supply source mix</h3>
              <ul className="text-sm space-y-1 text-gray-700">
                {Object.entries(sourceCounts).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k.replace(/_/g, " ")}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-brand-50 border border-brand-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-brand-900">{value}</p>
    </div>
  );
}
