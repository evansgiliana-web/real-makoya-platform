"use client";

import { useCallback, useEffect, useState } from "react";
import { STANDARD_CATEGORIES, autoRankLines } from "@/lib/productCatalog";

export type ProductLineForm = {
  category: string;
  brand: string;
  rank: string;
  estimatedMonthlyUnits: string;
  estimatedUnitPriceZar: string;
  notes: string;
};

const emptyLine: ProductLineForm = {
  category: "",
  brand: "",
  rank: "",
  estimatedMonthlyUnits: "",
  estimatedUnitPriceZar: "",
  notes: "",
};

type BrandOpt = { name: string; category: string | null };

type Props = {
  lines: ProductLineForm[];
  onChange: (lines: ProductLineForm[]) => void;
};

export default function ProductLinesEditor({ lines, onChange }: Props) {
  const [brands, setBrands] = useState<BrandOpt[]>([]);
  const [categories, setCategories] = useState<string[]>([...STANDARD_CATEGORIES]);

  useEffect(() => {
    fetch("/api/catalog/suggestions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.brands)) setBrands(data.brands);
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        /* offline / error — keep standard categories */
      });
  }, []);

  const applyRank = useCallback(
    (next: ProductLineForm[]) => onChange(autoRankLines(next)),
    [onChange]
  );

  function updateLine(i: number, field: keyof ProductLineForm, value: string) {
    const next = lines.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
      // Selecting a catalog brand can prefill category once
      if (field === "brand") {
        const match = brands.find(
          (b) => b.name.toLowerCase() === value.toLowerCase()
        );
        if (match?.category && !line.category) {
          updated.category = match.category;
        }
      }
      return updated;
    });
    if (field === "estimatedMonthlyUnits" || field === "estimatedUnitPriceZar") {
      applyRank(next);
    } else {
      onChange(next);
    }
  }

  function addLine() {
    onChange([...lines, { ...emptyLine }]);
  }

  function removeLine(i: number) {
    applyRank(lines.filter((_, idx) => idx !== i));
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold text-brand-900 mb-1">Top product lines</h2>
      <p className="text-xs text-gray-500 mb-4">
        Pick category and brand from the list, or type a new name. Rank is set
        automatically from estimated monthly sale value (units × price), highest
        first.
      </p>

      <div className="space-y-3">
        {lines.map((line, i) => {
          const units = parseFloat(line.estimatedMonthlyUnits) || 0;
          const price = parseFloat(line.estimatedUnitPriceZar) || 0;
          const value = units > 0 && price > 0 ? units * price : 0;

          return (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-end rounded-lg border border-gray-100 bg-gray-50/40 p-2"
            >
              <div className="col-span-12 sm:col-span-3">
                <label className="label text-xs">Category</label>
                <input
                  list={`cat-list-${i}`}
                  className="input"
                  placeholder="Select or type"
                  value={line.category}
                  onChange={(e) => updateLine(i, "category", e.target.value)}
                />
                <datalist id={`cat-list-${i}`}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="col-span-12 sm:col-span-3">
                <label className="label text-xs">Brand</label>
                <input
                  list={`brand-list-${i}`}
                  className="input"
                  placeholder="Select or type"
                  value={line.brand}
                  onChange={(e) => updateLine(i, "brand", e.target.value)}
                />
                <datalist id={`brand-list-${i}`}>
                  {brands.map((b) => (
                    <option key={b.name} value={b.name} />
                  ))}
                </datalist>
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="label text-xs">Units / month</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  placeholder="0"
                  value={line.estimatedMonthlyUnits}
                  onChange={(e) =>
                    updateLine(i, "estimatedMonthlyUnits", e.target.value)
                  }
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="label text-xs">Avg price (R)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={line.estimatedUnitPriceZar}
                  onChange={(e) =>
                    updateLine(i, "estimatedUnitPriceZar", e.target.value)
                  }
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <label className="label text-xs">Rank</label>
                <div
                  className="input flex items-center justify-center font-semibold text-brand-800 bg-brand-50"
                  title="Auto from sale value"
                >
                  {line.rank || "—"}
                </div>
              </div>

              <div className="col-span-1 flex justify-end pb-1">
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-red-500 text-sm px-1"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>

              <div className="col-span-12 sm:col-span-8">
                <input
                  className="input"
                  placeholder="Notes (optional)"
                  value={line.notes}
                  onChange={(e) => updateLine(i, "notes", e.target.value)}
                />
              </div>
              <div className="col-span-12 sm:col-span-4 text-xs text-gray-500 flex items-center">
                {value > 0
                  ? `Est. line value: R${Math.round(value).toLocaleString()}`
                  : "Enter units and price to auto-rank"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={addLine} className="btn-secondary text-xs">
          + Add product line
        </button>
        <button
          type="button"
          onClick={() => applyRank(lines)}
          className="btn-secondary text-xs"
        >
          Recalculate ranks
        </button>
      </div>
    </section>
  );
}
