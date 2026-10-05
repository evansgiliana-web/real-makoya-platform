"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  assessmentId: string;
  currentStatus: string;
};

export default function ReviewButton({ assessmentId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  if (currentStatus === "REVIEWED") {
    return (
      <span className="badge bg-green-100 text-green-700 text-xs">Reviewed ✓</span>
    );
  }

  async function act(action: "review" | "flag") {
    setLoading(true);
    const res = await fetch(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNotes: notes || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Review failed");
    }
  }

  return (
    <div className="inline-block">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary text-xs"
        >
          Review / Approve
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-2 min-w-[220px]">
          <textarea
            placeholder="Optional review notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => act("review")}
              className="btn-primary text-xs"
            >
              {loading ? "…" : "Approve (Reviewed)"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => act("flag")}
              className="btn-secondary text-xs text-red-600"
            >
              Flag
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
