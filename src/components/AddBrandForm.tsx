"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AddBrandForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      category: form.get("category") || undefined,
    };

    const res = await fetch(`/api/organizations/${organizationId}/brands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Could not add this brand — it may already exist for this organization.");
      return;
    }

    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">Brand Name</label>
        <input name="name" required className="input" placeholder="e.g. Fanta" />
      </div>
      <div>
        <label className="label">Category (optional)</label>
        <input name="category" className="input" placeholder="e.g. Soft Drinks" />
      </div>
      <button type="submit" disabled={loading} className="btn-secondary text-sm">
        {loading ? "Adding…" : "+ Add Brand"}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}
