"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { value: string; label: string };

type Props = {
  provinces: string[];
  stores: { id: string; name: string; town: string; province: string }[];
  showBrand?: boolean;
  brands?: { id: string; name: string }[];
  orgName?: string;
};

export default function ReportFilters({
  provinces,
  stores,
  showBrand,
  brands = [],
  orgName = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") params.delete(key);
    else params.set(key, value);
    // Changing province clears store if store not in province — parent filters; optional clear store
    if (key === "province") params.delete("storeId");
    router.push(`${pathname}?${params.toString()}`);
  }

  const province = searchParams.get("province") || "ALL";
  const storeId = searchParams.get("storeId") || "ALL";
  const turnover = searchParams.get("turnover") || "ALL";
  const view = searchParams.get("view") || "combined";
  const brand = searchParams.get("brand") || "ALL";

  const storesForProvince =
    province === "ALL" ? stores : stores.filter((s) => s.province === province);

  return (
    <div className="no-print flex flex-wrap items-end gap-3 mb-6">
      {showBrand && brands.length > 1 && (
        <div>
          <label className="label">Brand</label>
          <select
            className="input min-w-[180px]"
            value={brand}
            onChange={(e) => update("brand", e.target.value)}
          >
            <option value="ALL">All {orgName} brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Province / region</label>
        <select
          className="input min-w-[160px]"
          value={province}
          onChange={(e) => update("province", e.target.value)}
        >
          <option value="ALL">All provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Store</label>
        <select
          className="input min-w-[200px]"
          value={storeId}
          onChange={(e) => update("storeId", e.target.value)}
        >
          <option value="ALL">All stores</option>
          {storesForProvince.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.town})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Est. monthly turnover</label>
        <select
          className="input min-w-[160px]"
          value={turnover}
          onChange={(e) => update("turnover", e.target.value)}
        >
          <option value="ALL">Any</option>
          <option value="0-20k">Under R20,000</option>
          <option value="20k-50k">R20,000 – R50,000</option>
          <option value="50k+">Over R50,000</option>
          <option value="unknown">Not recorded</option>
        </select>
      </div>

      <div>
        <label className="label">View</label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            type="button"
            className={`px-3 py-2 ${
              view === "combined"
                ? "bg-brand-700 text-white"
                : "bg-white text-gray-700 hover:bg-brand-50"
            }`}
            onClick={() => update("view", "combined")}
          >
            Combined
          </button>
          <button
            type="button"
            className={`px-3 py-2 border-l border-gray-300 ${
              view === "by-store"
                ? "bg-brand-700 text-white"
                : "bg-white text-gray-700 hover:bg-brand-50"
            }`}
            onClick={() => update("view", "by-store")}
          >
            By store
          </button>
        </div>
      </div>
    </div>
  );
}
