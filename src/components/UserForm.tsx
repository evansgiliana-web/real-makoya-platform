"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function UserForm({ canCreateAdmins }: { canCreateAdmins: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState("FIELD_AGENT");
  const [allBrandsAccess, setAllBrandsAccess] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const brandAccessRaw = String(form.get("brandAccess") || "");

    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role,
      companyName: form.get("companyName") || undefined,
      allBrandsAccess,
      brandAccess: brandAccessRaw
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.toString() || "Could not create user.");
      return;
    }

    setSuccess("User created successfully.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Full Name *</label>
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
        <label className="label">Access Level (Role) *</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
          <option value="FIELD_AGENT">Field Agent — capture only</option>
          <option value="ADMIN" disabled={!canCreateAdmins}>
            Agency Admin — full internal access
          </option>
          <option value="SUPER_ADMIN" disabled={!canCreateAdmins}>
            Super Admin — full platform control
          </option>
          <option value="CLIENT">FMCG Client — read-only reports</option>
        </select>
        {!canCreateAdmins && (
          <p className="text-xs text-gray-400 mt-1">
            Only a Super Admin can create Admin or Super Admin accounts.
          </p>
        )}
      </div>

      {role === "CLIENT" && (
        <div className="rounded-lg bg-brand-50 p-3 space-y-3">
          <div>
            <label className="label">FMCG Company Name</label>
            <input name="companyName" className="input" placeholder="e.g. Tiger Brands" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allBrandsAccess}
              onChange={(e) => setAllBrandsAccess(e.target.checked)}
              className="h-4 w-4"
            />
            Full market access (all brands & stores)
          </label>
          {!allBrandsAccess && (
            <div>
              <label className="label">Restrict to Brands (comma-separated)</label>
              <input name="brandAccess" className="input" placeholder="e.g. Omo, Sunlight, Jik" />
              <p className="text-xs text-gray-400 mt-1">
                This client will only see report data tied to these brand names.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create User"}
      </button>
    </form>
  );
}
