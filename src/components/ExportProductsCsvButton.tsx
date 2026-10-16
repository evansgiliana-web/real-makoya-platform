"use client";

import { useSearchParams } from "next/navigation";

export default function ExportProductsCsvButton() {
  const searchParams = useSearchParams();

  const href = `/api/export/report-csv?${searchParams.toString()}`;

  return (
    <a href={href} className="btn-secondary text-sm no-print">
      Export products CSV
    </a>
  );
}
