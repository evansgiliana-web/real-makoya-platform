"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";

type ProductLine = {
  category: string;
  brand: string;
  rank: string;
  estimatedMonthlyUnits: string;
  estimatedUnitPriceZar: string;
  notes: string;
};

const emptyLine: ProductLine = {
  category: "",
  brand: "",
  rank: "",
  estimatedMonthlyUnits: "",
  estimatedUnitPriceZar: "",
  notes: "",
};

type AssessmentInitial = {
  id: string;
  storeId: string;
  productLines?: {
    category: string;
    brand: string;
    rank?: number | null;
    estimatedMonthlyUnits?: number | null;
    estimatedUnitPriceZar?: number | null;
    notes?: string | null;
  }[];
  sourceType?: string;
  supplierName?: string | null;
  supplierLocation?: string | null;
  distributionNotes?: string | null;
  hasValidCoA?: boolean;
  coaNotes?: string | null;
  hasHealthPermit?: boolean;
  healthPermitNumber?: string | null;
  healthPermitExpiry?: string | null;
  brandAuthenticityVerified?: boolean;
  complianceNotes?: string | null;
  counterfeitRisk?: string;
  packagingIssueFlag?: boolean;
  batchCodeIssueFlag?: boolean;
  pricingAnomalyFlag?: boolean;
  counterfeitNotes?: string | null;
  packingShelvesCount?: number | null;
  posInstalled?: boolean;
  posBrand?: string | null;
  posModel?: string | null;
  posPhotoUrls?: string[];
  internetConnectivity?: string;
  scannerInstalled?: boolean;
  scannerDetails?: string | null;
  equipmentPhotoUrls?: string[];
  totalSkuCount?: number | null;
  estimatedMonthlyTurnoverZar?: number | null;
  internalNotes?: string | null;
  photoUrls?: string[];
};

export default function AssessmentForm({
  storeId,
  initial,
}: {
  storeId: string;
  initial?: AssessmentInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [lines, setLines] = useState<ProductLine[]>(
    initial?.productLines && initial.productLines.length > 0
      ? initial.productLines.map((p) => ({
          category: p.category || "",
          brand: p.brand || "",
          rank: p.rank != null ? String(p.rank) : "",
          estimatedMonthlyUnits:
            p.estimatedMonthlyUnits != null ? String(p.estimatedMonthlyUnits) : "",
          estimatedUnitPriceZar:
            p.estimatedUnitPriceZar != null ? String(p.estimatedUnitPriceZar) : "",
          notes: p.notes || "",
        }))
      : [{ ...emptyLine }]
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [posPhotos, setPosPhotos] = useState<string[]>(initial?.posPhotoUrls || []);
  const [equipmentPhotos, setEquipmentPhotos] = useState<string[]>(
    initial?.equipmentPhotoUrls || []
  );
  const [counterfeitPhotos, setCounterfeitPhotos] = useState<string[]>(
    initial?.photoUrls || []
  );
  const [posInstalled, setPosInstalled] = useState(Boolean(initial?.posInstalled));
  const [scannerInstalled, setScannerInstalled] = useState(Boolean(initial?.scannerInstalled));

  function updateLine(i: number, field: keyof ProductLine, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const payload = {
      storeId,
      productLines: lines
        .filter((l) => l.category && l.brand)
        .map((l) => ({
          category: l.category,
          brand: l.brand,
          rank: l.rank ? Number(l.rank) : null,
          estimatedMonthlyUnits: l.estimatedMonthlyUnits ? Number(l.estimatedMonthlyUnits) : null,
          estimatedUnitPriceZar: l.estimatedUnitPriceZar ? Number(l.estimatedUnitPriceZar) : null,
          notes: l.notes || undefined,
        })),
      sourceType: form.get("sourceType"),
      supplierName: form.get("supplierName") || undefined,
      supplierLocation: form.get("supplierLocation") || undefined,
      distributionNotes: form.get("distributionNotes") || undefined,

      hasValidCoA: form.get("hasValidCoA") === "on",
      coaNotes: form.get("coaNotes") || undefined,
      hasHealthPermit: form.get("hasHealthPermit") === "on",
      healthPermitNumber: form.get("healthPermitNumber") || undefined,
      healthPermitExpiry: form.get("healthPermitExpiry") || undefined,
      brandAuthenticityVerified: form.get("brandAuthenticityVerified") === "on",
      complianceNotes: form.get("complianceNotes") || undefined,

      counterfeitRisk: form.get("counterfeitRisk"),
      packagingIssueFlag: form.get("packagingIssueFlag") === "on",
      batchCodeIssueFlag: form.get("batchCodeIssueFlag") === "on",
      pricingAnomalyFlag: form.get("pricingAnomalyFlag") === "on",
      counterfeitNotes: form.get("counterfeitNotes") || undefined,

      packingShelvesCount: form.get("packingShelvesCount") ? Number(form.get("packingShelvesCount")) : undefined,
      posInstalled,
      posBrand: form.get("posBrand") || undefined,
      posModel: form.get("posModel") || undefined,
      posPhotoUrls: posPhotos,
      internetConnectivity: form.get("internetConnectivity"),
      scannerInstalled,
      scannerDetails: form.get("scannerDetails") || undefined,
      equipmentPhotoUrls: equipmentPhotos,

      totalSkuCount: form.get("totalSkuCount") ? Number(form.get("totalSkuCount")) : undefined,
      estimatedMonthlyTurnoverZar: form.get("estimatedMonthlyTurnoverZar")
        ? Number(form.get("estimatedMonthlyTurnoverZar"))
        : undefined,

      internalNotes: form.get("internalNotes") || undefined,
    };

    // Include counterfeit evidence photos
    (payload as any).photoUrls = counterfeitPhotos;

    const url = isEdit ? `/api/assessments/${initial!.id}` : "/api/assessments";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        typeof data.error === "string"
          ? data.error
          : "Could not save assessment. Please check the required fields."
      );
      return;
    }

    router.push(`/dashboard/stores/${storeId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Top-selling product lines */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Top-Selling Product Lines</h2>
        <p className="text-xs text-gray-500 mb-4">
          Log the most-sold FMCG categories and brands to build a live demand picture.
        </p>

        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-3 items-start">
            <input
              placeholder="Category (e.g. Beverages)"
              className="input col-span-2"
              value={line.category}
              onChange={(e) => updateLine(i, "category", e.target.value)}
            />
            <input
              placeholder="Brand"
              className="input col-span-2"
              value={line.brand}
              onChange={(e) => updateLine(i, "brand", e.target.value)}
            />
            <input
              placeholder="Rank"
              type="number"
              className="input col-span-1"
              value={line.rank}
              onChange={(e) => updateLine(i, "rank", e.target.value)}
            />
            <input
              placeholder="Est. monthly units"
              type="number"
              className="input col-span-2"
              value={line.estimatedMonthlyUnits}
              onChange={(e) => updateLine(i, "estimatedMonthlyUnits", e.target.value)}
            />
            <input
              placeholder="Avg price (R)"
              type="number"
              step="0.01"
              className="input col-span-2"
              value={line.estimatedUnitPriceZar}
              onChange={(e) => updateLine(i, "estimatedUnitPriceZar", e.target.value)}
            />
            <input
              placeholder="Notes"
              className="input col-span-2"
              value={line.notes}
              onChange={(e) => updateLine(i, "notes", e.target.value)}
            />
            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              className="col-span-1 text-red-500 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
          className="btn-secondary text-xs"
        >
          + Add product line
        </button>
      </section>

      {/* Trade & distribution routes */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Trade & Distribution Routes</h2>
        <p className="text-xs text-gray-500 mb-4">
          Trace where stock is sourced from — formal wholesaler, informal bulk buyer, or
          unverified supplier.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Source Type *</label>
            <select name="sourceType" required className="input" defaultValue={initial?.sourceType || "FORMAL_WHOLESALER"}>
              <option value="FORMAL_WHOLESALER">Formal Wholesaler</option>
              <option value="INFORMAL_BULK_BUYER">Informal Bulk Buyer</option>
              <option value="UNVERIFIED_SUPPLIER">Unverified Supplier</option>
              <option value="MIXED">Mixed Sources</option>
            </select>
          </div>
          <div>
            <label className="label">Supplier Name</label>
            <input name="supplierName" defaultValue={initial?.supplierName || ""} className="input" />
          </div>
          <div>
            <label className="label">Supplier Location</label>
            <input name="supplierLocation" defaultValue={initial?.supplierLocation || ""} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Distribution Notes</label>
            <textarea name="distributionNotes" defaultValue={initial?.distributionNotes || ""} rows={2} className="input" />
          </div>
        </div>
      </section>

      {/* Compliance & CoA */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Compliance & CoA Verification</h2>
        <p className="text-xs text-gray-500 mb-4">
          Check for valid Certificates of Analysis, health permits and brand authenticity
          markers.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hasValidCoA" className="h-4 w-4" /> Valid Certificate of
            Analysis present
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hasHealthPermit" className="h-4 w-4" /> Health permit
            present
          </label>
          <div>
            <label className="label">Health Permit Number</label>
            <input name="healthPermitNumber" defaultValue={initial?.healthPermitNumber || ""} className="input" />
          </div>
          <div>
            <label className="label">Health Permit Expiry</label>
            <input type="date" name="healthPermitExpiry" className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm col-span-2">
            <input type="checkbox" name="brandAuthenticityVerified" className="h-4 w-4" /> Brand
            authenticity markers verified (hologram, seal, QR code etc.)
          </label>
          <div className="col-span-2">
            <label className="label">CoA / Compliance Notes</label>
            <textarea name="coaNotes" defaultValue={initial?.coaNotes || ""} rows={2} className="input" />
          </div>
        </div>
      </section>

      {/* Counterfeit screening */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Counterfeit Screening</h2>
        <p className="text-xs text-gray-500 mb-4">
          Physically inspect stock against known counterfeit indicators — packaging, batch
          codes, pricing anomalies.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Overall Counterfeit Risk *</label>
            <select name="counterfeitRisk" required className="input" defaultValue={initial?.counterfeitRisk || "NONE"}>
              <option value="NONE">None observed</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CONFIRMED_COUNTERFEIT">Confirmed Counterfeit</option>
            </select>
          </div>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="packagingIssueFlag" className="h-4 w-4" /> Packaging
              inconsistency
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="batchCodeIssueFlag" className="h-4 w-4" /> Batch code
              issue
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pricingAnomalyFlag" className="h-4 w-4" /> Pricing
              anomaly
            </label>
          </div>
          <div className="col-span-2">
            <label className="label">Counterfeit Screening Notes</label>
            <textarea name="counterfeitNotes" rows={2} className="input" defaultValue={initial?.counterfeitNotes || ""} />
          <div className="mt-3">
            <ImageUploader
              label="Counterfeit evidence photos"
              urls={counterfeitPhotos}
              onChange={setCounterfeitPhotos}
            />
          </div>
          </div>
        </div>
      </section>

      {/* Commercial metrics */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Commercial Metrics</h2>
        <p className="text-xs text-gray-500 mb-4">
          Estimate store scale for client dashboards — total SKUs on shelf and monthly
          turnover (whole store, ZAR).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Total SKUs / products on shelf</label>
            <input
              type="number"
              name="totalSkuCount"
              min={0}
              className="input"
              placeholder="e.g. 120"
            />
          </div>
          <div>
            <label className="label">Est. monthly store turnover (ZAR)</label>
            <input
              type="number"
              name="estimatedMonthlyTurnoverZar"
              min={0}
              step="100"
              className="input"
              placeholder="e.g. 85000"
            />
          </div>
        </div>
      </section>

      {/* Store infrastructure & equipment */}
      <section className="card p-6">
        <h2 className="font-semibold text-brand-900 mb-1">Store Infrastructure & Equipment</h2>
        <p className="text-xs text-gray-500 mb-4">
          Capture what the store has to work with — shelving, point-of-sale technology,
          scanners and connectivity.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Number of Packing Shelves</label>
            <input type="number" name="packingShelvesCount" min={0} className="input" />
          </div>
          <div>
            <label className="label">Internet Connectivity</label>
            <select name="internetConnectivity" className="input" defaultValue={initial?.internetConnectivity || "UNKNOWN"}>
              <option value="NONE">None</option>
              <option value="MOBILE_DATA">Mobile Data</option>
              <option value="WIFI">Wi-Fi</option>
              <option value="FIBER">Fiber</option>
              <option value="UNKNOWN">Unknown / Not checked</option>
            </select>
          </div>

          <div className="col-span-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={posInstalled}
                onChange={(e) => setPosInstalled(e.target.checked)}
                className="h-4 w-4"
              />
              Point-of-sale (POS) system installed
            </label>
            {posInstalled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="label">POS Brand</label>
                  <input name="posBrand" defaultValue={initial?.posBrand || ""} className="input" placeholder="e.g. Yoco, iKhokha" />
                </div>
                <div>
                  <label className="label">POS Model</label>
                  <input name="posModel" defaultValue={initial?.posModel || ""} className="input" />
                </div>
                <div className="col-span-2">
                  <ImageUploader label="POS Photos" urls={posPhotos} onChange={setPosPhotos} />
                </div>
              </div>
            )}
          </div>

          <div className="col-span-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={scannerInstalled}
                onChange={(e) => setScannerInstalled(e.target.checked)}
                className="h-4 w-4"
              />
              Barcode scanner present
            </label>
            {scannerInstalled && (
              <div className="pl-6">
                <label className="label">Scanner Details</label>
                <input name="scannerDetails" defaultValue={initial?.scannerDetails || ""} className="input" placeholder="Brand / model / condition" />
              </div>
            )}
          </div>

          <div className="col-span-2 border-t border-gray-100 pt-4">
            <ImageUploader
              label="General Equipment Photos (fridges, shelving, storage)"
              urls={equipmentPhotos}
              onChange={setEquipmentPhotos}
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <label className="label">Internal Notes (agency staff only — never shown to clients)</label>
        <textarea name="internalNotes" defaultValue={initial?.internalNotes || ""} rows={2} className="input" />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : isEdit ? "Save changes" : "Submit Assessment"}
      </button>
    </form>
  );
}
