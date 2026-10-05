"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storeId: string;
  alreadyRedacted?: boolean;
};

export default function RedactPiiButton({ storeId, alreadyRedacted }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (alreadyRedacted) {
    return (
      <span className="badge bg-gray-100 text-gray-600 text-xs">PII redacted</span>
    );
  }

  async function handleRedact() {
    if (
      !confirm(
        "This will permanently clear the owner contact number, ID/reg number, and store telephone from this record. Continue?"
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "redact_pii" }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Redaction failed");
    }
  }

  return (
    <button
      type="button"
      onClick={handleRedact}
      disabled={loading}
      className="btn-secondary text-xs text-amber-800 border-amber-300"
    >
      {loading ? "Redacting…" : "Redact owner PII"}
    </button>
  );
}
