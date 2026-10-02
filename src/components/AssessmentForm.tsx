"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type ProductLine = { category: string; brand: string; rank: string; estimatedMonthlyUnits: string; notes: string };

const emptyLine: ProductLine = { category: "", brand: "", rank: "", estimatedMonthlyUnits: "", notes: "" };

export default function AssessmentForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<ProductLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      internalNotes: form.get("internalNotes") || undefined,
    };

    const res = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Could not save assessment. Please check the required fields.");
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
              className="input col-span-3"
              value={line.category}
              onChange={(e) => updateLine(i, "category", e.target.value)}
            />
            <input
              placeholder="Brand"
              className="input col-span-3"
              value={line.brand}
              onChange={(e) => updateLine(i, "brand", e.target.value)}
            />
            <input
              placeholder="Rank"
              type="number"
              className="input col-span-2"
              value={line.rank}
              onChange={(e) => updateLine(i, "rank", e.target.value)}
            />
            <input
              placeholder="Est. monthly units"
              type="number"
              className="input col-span-3"
              value={line.estimatedMonthlyUnits}
              onChange={(e) => updateLine(i, "estimatedMonthlyUnits", e.target.value)}
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
            <select name="sourceType" required className="input">
              <option value="FORMAL_WHOLESALER">Formal Wholesaler</option>
              <option value="INFORMAL_BULK_BUYER">Informal Bulk Buyer</option>
              <option value="UNVERIFIED_SUPPLIER">Unverified Supplier</option>
              <option value="MIXED">Mixed Sources</option>
            </select>
          </div>
          <div>
            <label className="label">Supplier Name</label>
            <input name="supplierName" className="input" />
          </div>
          <div>
            <label className="label">Supplier Location</label>
            <input name="supplierLocation" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Distribution Notes</label>
            <textarea name="distributionNotes" rows={2} className="input" />
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
            <input name="healthPermitNumber" className="input" />
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
            <textarea name="coaNotes" rows={2} className="input" />
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
            <select name="counterfeitRisk" required className="input" defaultValue="NONE">
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
            <textarea name="counterfeitNotes" rows={2} className="input" />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <label className="label">Internal Notes (agency staff only — never shown to clients)</label>
        <textarea name="internalNotes" rows={2} className="input" />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : "Submit Assessment"}
      </button>
    </form>
  );
}
