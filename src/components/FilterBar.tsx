"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function FilterBar({ regions }: { regions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-500">Filter:</label>
      <select
        defaultValue={searchParams.get("period") || "ALL"}
        onChange={(e) => setParam("period", e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="WEEK">This Week</option>
        <option value="MONTH">This Month</option>
        <option value="ALL">All Time</option>
      </select>

      <label className="text-gray-500 ml-2">Region:</label>
      <select
        defaultValue={searchParams.get("region") || "ALL"}
        onChange={(e) => setParam("region", e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="ALL">All</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
