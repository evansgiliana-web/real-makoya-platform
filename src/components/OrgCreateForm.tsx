"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function OrgCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const brandNames = String(form.get("brandNames") || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    const payload = {
      name: form.get("name"),
      brandNames,
      ownerName: form.get("ownerName"),
      ownerEmail: form.get("ownerEmail"),
      ownerPassword: form.get("ownerPassword"),
    };

    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        typeof data.error === "string"
          ? data.error
          : "Could not create organization. Check the required fields."
      );
      return;
    }

    const org = await res.json();
    router.push(`/dashboard/organizations/${org.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">FMCG Company Name *</label>
        <input name="name" required className="input" placeholder="e.g. Coca-Cola South Africa" />
      </div>
      <div>
        <label className="label">Brands (comma-separated) *</label>
        <input name="brandNames" required className="input" placeholder="e.g. Coke, Fanta, Sprite" />
        <p className="text-xs text-gray-400 mt-1">
          Product lines agents type during capture auto-link to these if the name matches.
        </p>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-brand-900 mb-2">First team member (Owner)</p>
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input name="ownerName" required className="input" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" name="ownerEmail" required className="input" />
          </div>
          <div>
            <label className="label">Temporary Password *</label>
            <input type="password" name="ownerPassword" required minLength={8} className="input" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          This person can see all brands by default and can invite their own teammates once
          logged in.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create Organization"}
      </button>
    </form>
  );
}
