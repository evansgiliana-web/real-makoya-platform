"use client";

import { useCallback, useEffect, useState } from "react";
import { STANDARD_CATEGORIES, autoRankLines } from "@/lib/productCatalog";

export type ProductLineForm = {
  category: string;
  brand: string;
  rank: string;
  estimatedMonthlyUnits: string;
  estimatedUnitPriceZar: string;
  notes: string; // product description (size, variant, pack, etc.)
};

const OTHER = "__OTHER__";

type BrandOpt = { name: string; category: string | null };

type Props = {
  lines: ProductLineForm[];
  onChange: (lines: ProductLineForm[]) => void;
};

function categorySelectValue(category: string, categories: string[]): string {
  if (!category) return "";
  if (categories.includes(category)) return category;
  return OTHER;
}

function brandSelectValue(brand: string, brands: BrandOpt[]): string {
  if (!brand) return "";
  if (brands.some((b) => b.name === brand)) return brand;
  return OTHER;
}

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
      .catch(() => {});
  }, []);

  const applyRank = useCallback(
    (next: ProductLineForm[]) => onChange(autoRankLines(next)),
    [onChange]
  );

  function updateLine(i: number, field: keyof ProductLineForm, value: string) {
    const next = lines.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
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

  function onCategorySelect(i: number, value: string) {
    if (value === OTHER) {
      const current = lines[i].category;
      const keep = current && !categories.includes(current) ? current : "";
      updateLine(i, "category", keep);
      return;
    }
    updateLine(i, "category", value);
  }

  function onBrandSelect(i: number, value: string) {
    if (value === OTHER) {
      const current = lines[i].brand;
      const keep = current && !brands.some((b) => b.name === current) ? current : "";
      updateLine(i, "brand", keep);
      return;
    }
    updateLine(i, "brand", value);
  }

  function addLine() {
    onChange([
      ...lines,
      {
        category: "",
        brand: "",
        rank: "",
        estimatedMonthlyUnits: "",
        estimatedUnitPriceZar: "",
        notes: "",
      },
    ]);
  }

  function removeLine(i: number) {
    applyRank(lines.filter((_, idx) => idx !== i));
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold text-brand-900 mb-1">Top product lines</h2>
      <p className="text-xs text-gray-500 mb-4">
        Choose <strong>Category</strong> and <strong>Brand</strong>, then add a short{" "}
        <strong>Description</strong> (e.g. pack size, flavour, variant). Rank is automatic
        from units × price.
      </p>

      <div className="space-y-4">
        {lines.map((line, i) => {
          const units = parseFloat(line.estimatedMonthlyUnits) || 0;
          const price = parseFloat(line.estimatedUnitPriceZar) || 0;
          const value = units > 0 && price > 0 ? units * price : 0;

          const catSel = categorySelectValue(line.category, categories);
          const brandSel = brandSelectValue(line.brand, brands);
          const showCustomCategory = catSel === OTHER;
          const showCustomBrand = brandSel === OTHER;

          return (
            <div
              key={i}
              className="rounded-lg border border-gray-100 bg-gray-50/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500">
                  Line {i + 1}
                  {line.rank ? ` · Rank ${line.rank}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-red-500 text-sm px-1"
                  aria-label="Remove line"
                >
                  ✕ Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Category *</label>
                  <select
                    className="input"
                    value={catSel}
                    onChange={(e) => onCategorySelect(i, e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={OTHER}>Other… (type new)</option>
                  </select>
                  {showCustomCategory && (
                    <input
                      className="input mt-1"
                      placeholder="Type category name"
                      value={line.category}
                      onChange={(e) => updateLine(i, "category", e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="label text-xs">Brand *</label>
                  <select
                    className="input"
                    value={brandSel}
                    onChange={(e) => onBrandSelect(i, e.target.value)}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    <option value={OTHER}>Other… (type new)</option>
                  </select>
                  {showCustomBrand && (
                    <input
                      className="input mt-1"
                      placeholder="Type brand name"
                      value={line.brand}
                      onChange={(e) => updateLine(i, "brand", e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="label text-xs">Description</label>
                <input
                  className="input"
                  placeholder="e.g. 2L bottle, Original flavour, 12-pack, bar soap 175g"
                  value={line.notes}
                  onChange={(e) => updateLine(i, "notes", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
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
                <div>
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
                <div>
                  <label className="label text-xs">Rank (auto)</label>
                  <div className="input flex items-center justify-center font-semibold text-brand-800 bg-brand-50">
                    {line.rank || "—"}
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center min-h-[42px]">
                  {value > 0
                    ? `Line value: R${Math.round(value).toLocaleString()}`
                    : "Units × price → rank"}
                </div>
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
