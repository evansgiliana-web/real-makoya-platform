"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Brand = { id: string; name: string };

export default function BrandSwitcher({ brands, orgName }: { brands: Brand[]; orgName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setBrand(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete("brand");
    else params.set("brand", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      defaultValue={searchParams.get("brand") || "ALL"}
      onChange={(e) => setBrand(e.target.value)}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm no-print"
    >
      <option value="ALL">All {orgName} brands (umbrella view)</option>
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name} only
        </option>
      ))}
    </select>
  );
}
