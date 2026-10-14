"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserForm({ canCreateAdmins }: { canCreateAdmins: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
      role: form.get("role"),
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
        <select name="role" defaultValue="FIELD_AGENT" className="input">
          <option value="FIELD_AGENT">Field Agent — capture only</option>
          <option value="ADMIN" disabled={!canCreateAdmins}>
            Agency Admin — full internal access
          </option>
          <option value="SUPER_ADMIN" disabled={!canCreateAdmins}>
            Super Admin — full platform control
          </option>
        </select>
        {!canCreateAdmins && (
          <p className="text-xs text-gray-400 mt-1">
            Only a Super Admin can create Admin or Super Admin accounts.
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 bg-brand-50 rounded-lg px-3 py-2">
        Setting up an FMCG client login? Use{" "}
        <Link href="/dashboard/organizations" className="text-brand-700 font-medium underline">
          Organizations →
        </Link>{" "}
        instead — client accounts need to belong to a company and brand(s).
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create User"}
      </button>
    </form>
  );
}
