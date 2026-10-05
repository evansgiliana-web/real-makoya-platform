import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const regStyles: Record<string, string> = {
  REGISTERED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  UNREGISTERED: "bg-red-100 text-red-700",
  UNKNOWN: "bg-gray-100 text-gray-700",
};

const riskStyles: Record<string, string> = {
  NONE: "bg-green-100 text-green-700",
  LOW: "bg-yellow-100 text-yellow-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  HIGH: "bg-red-100 text-red-700",
  CONFIRMED_COUNTERFEIT: "bg-red-600 text-white",
};

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      assessments: {
        orderBy: { visitDate: "desc" },
        include: { productLines: true, agent: { select: { name: true } } },
      },
    },
  });

  if (!store) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">{store.name}</h1>
          <p className="text-sm text-gray-500">
            {store.address}, {store.town}, {store.province}
          </p>
        </div>
        <Link href={`/dashboard/stores/${store.id}/assess`} className="btn-primary">
          + New Assessment
        </Link>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">Ownership & Registration</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="font-medium">{store.ownerName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner Contact</dt>
            <dd className="font-medium">{store.ownerContactNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Store Telephone</dt>
            <dd className="font-medium">{store.storeTelephoneNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">GPS Location</dt>
            <dd className="font-medium">
              {store.latitude && store.longitude ? `${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}` : "Not captured"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Municipal Registration</dt>
            <dd>
              <span className={`badge ${regStyles[store.municipalRegistrationStatus]}`}>
                {store.municipalRegistrationStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Registration No.</dt>
            <dd className="font-medium">{store.municipalRegistrationNumber || "—"}</dd>
          </div>
          {store.registrationNotes && (
            <div className="col-span-2">
              <dt className="text-gray-500">Notes</dt>
              <dd>{store.registrationNotes}</dd>
            </div>
          )}
        </dl>
      </div>

      {store.storePhotoUrls.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-brand-900 mb-3">Store Photos</h2>
          <div className="grid grid-cols-4 gap-3">
            {store.storePhotoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="Store photo" className="h-28 w-full object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-brand-900 mb-3">Assessment History ({store.assessments.length})</h2>
      <div className="space-y-4">
        {store.assessments.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                {a.visitDate.toISOString().slice(0, 10)} · captured by {a.agent.name}
              </p>
              <span className={`badge ${riskStyles[a.counterfeitRisk]}`}>
                {a.counterfeitRisk.replace("_", " ")}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-brand-900 mb-1">Top Product Lines</p>
                {a.productLines.length === 0 && <p className="text-gray-400">None logged</p>}
                <ul className="space-y-0.5">
                  {a.productLines.map((p) => (
                    <li key={p.id} className="text-gray-600">
                      {p.rank ? `#${p.rank} ` : ""}
                      {p.brand} ({p.category})
                      {p.estimatedMonthlyUnits ? ` — ~${p.estimatedMonthlyUnits}/mo` : ""}
                      {p.estimatedUnitPriceZar ? ` @ R${p.estimatedUnitPriceZar.toFixed(2)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-brand-900 mb-1">Trade & Distribution</p>
                <p className="text-gray-600">Source: {a.sourceType.replace("_", " ")}</p>
                {a.supplierName && <p className="text-gray-600">Supplier: {a.supplierName}</p>}
              </div>
              <div>
                <p className="font-medium text-brand-900 mb-1">Compliance</p>
                <p className="text-gray-600">CoA: {a.hasValidCoA ? "Valid" : "Not confirmed"}</p>
                <p className="text-gray-600">
                  Health Permit: {a.hasHealthPermit ? a.healthPermitNumber || "Present" : "Not confirmed"}
                </p>
                <p className="text-gray-600">
                  Brand authenticity: {a.brandAuthenticityVerified ? "Verified" : "Not verified"}
                </p>
              </div>
              <div>
                <p className="font-medium text-brand-900 mb-1">Counterfeit Indicators</p>
                <p className="text-gray-600">
                  {[
                    a.packagingIssueFlag && "Packaging",
                    a.batchCodeIssueFlag && "Batch code",
                    a.pricingAnomalyFlag && "Pricing anomaly",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None flagged"}
                </p>
                {a.counterfeitNotes && <p className="text-gray-500 italic mt-1">{a.counterfeitNotes}</p>}
              </div>
              <div>
                <p className="font-medium text-brand-900 mb-1">Commercial Metrics</p>
                <p className="text-gray-600">Total SKUs: {a.totalSkuCount ?? "—"}</p>
                <p className="text-gray-600">
                  Est. monthly turnover:{" "}
                  {a.estimatedMonthlyTurnoverZar
                    ? `R${a.estimatedMonthlyTurnoverZar.toLocaleString()}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="font-medium text-brand-900 mb-1">Infrastructure & Equipment</p>
                <p className="text-gray-600">Packing shelves: {a.packingShelvesCount ?? "—"}</p>
                <p className="text-gray-600">
                  POS: {a.posInstalled ? `${a.posBrand || "Installed"}${a.posModel ? " " + a.posModel : ""}` : "Not installed"}
                </p>
                <p className="text-gray-600">
                  Scanner: {a.scannerInstalled ? a.scannerDetails || "Installed" : "Not installed"}
                </p>
                <p className="text-gray-600">Internet: {a.internetConnectivity.replace("_", " ")}</p>
              </div>
            </div>

            {(a.posPhotoUrls.length > 0 || a.equipmentPhotoUrls.length > 0) && (
              <div className="grid grid-cols-6 gap-2 mt-3 border-t border-gray-100 pt-3">
                {[...a.posPhotoUrls, ...a.equipmentPhotoUrls].map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="h-16 w-full object-cover rounded border border-gray-200" />
                ))}
              </div>
            )}

            {a.internalNotes && (
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                Internal note: {a.internalNotes}
              </p>
            )}
          </div>
        ))}
        {store.assessments.length === 0 && (
          <p className="text-sm text-gray-500">No assessments captured for this store yet.</p>
        )}
      </div>
    </div>
  );
}
