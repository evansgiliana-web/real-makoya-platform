"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Brand = { id: string; name: string };

export default function InviteMemberForm({
  organizationId,
  brands,
}: {
  organizationId: string;
  brands: Brand[];
}) {
  const router = useRouter();
  const [allBrandsAccess, setAllBrandsAccess] = useState(true);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleBrand(id: string) {
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      orgRole: form.get("orgRole") || "MEMBER",
      allBrandsAccess,
      brandIds: allBrandsAccess ? [] : selectedBrands,
    };

    const res = await fetch(`/api/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not invite this teammate.");
      return;
    }

    setSuccess("Teammate added.");
    (e.target as HTMLFormElement).reset();
    setSelectedBrands([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Name *</label>
        <input name="name" required className="input" />
      </div>
      <div>
        <label className="label">Email *</label>
        <input type="email" name="email" required className="input" />
      </div>
      <div>
        <label className="label">Temporary Password *</label>
        <input type="password" name="password" required minLength={8} className="input" />
      </div>
      <div>
        <label className="label">Role</label>
        <select name="orgRole" defaultValue="MEMBER" className="input">
          <option value="MEMBER">Member — read-only reports</option>
          <option value="OWNER">Owner — can also manage the team</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allBrandsAccess}
          onChange={(e) => setAllBrandsAccess(e.target.checked)}
          className="h-4 w-4"
        />
        Full access to all of this organization's brands
      </label>

      {!allBrandsAccess && (
        <div className="rounded-lg bg-brand-50 p-3">
          <p className="text-xs text-gray-500 mb-2">Pick which brands this person can see:</p>
          <div className="space-y-1">
            {brands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.id)}
                  onChange={() => toggleBrand(b.id)}
                  className="h-4 w-4"
                />
                {b.name}
              </label>
            ))}
            {brands.length === 0 && <p className="text-xs text-gray-400">No brands yet.</p>}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Adding…" : "Add Teammate"}
      </button>
    </form>
  );
}
