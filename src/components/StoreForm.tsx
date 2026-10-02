"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function StoreForm() {
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
      tradingAs: form.get("tradingAs") || undefined,
      address: form.get("address"),
      town: form.get("town"),
      province: form.get("province"),
      ownerName: form.get("ownerName"),
      ownerContactNumber: form.get("ownerContactNumber") || undefined,
      ownerIdOrCompanyRegNumber: form.get("ownerIdOrCompanyRegNumber") || undefined,
      municipalRegistrationStatus: form.get("municipalRegistrationStatus"),
      municipalRegistrationNumber: form.get("municipalRegistrationNumber") || undefined,
      registrationNotes: form.get("registrationNotes") || undefined,
    };

    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Could not save store. Please check the required fields.");
      return;
    }

    const store = await res.json();
    router.push(`/dashboard/stores/${store.id}/assess`);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6 max-w-2xl">
      <section>
        <h2 className="font-semibold text-brand-900 mb-3">Store Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Store Name *</label>
            <input name="name" required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Trading As (if different)</label>
            <input name="tradingAs" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Address *</label>
            <input name="address" required className="input" />
          </div>
          <div>
            <label className="label">Town *</label>
            <input name="town" required className="input" />
          </div>
          <div>
            <label className="label">Province *</label>
            <input name="province" required className="input" />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <h2 className="font-semibold text-brand-900 mb-3">Ownership & Registration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Owner Name *</label>
            <input name="ownerName" required className="input" />
          </div>
          <div>
            <label className="label">Owner Contact Number</label>
            <input name="ownerContactNumber" className="input" />
          </div>
          <div>
            <label className="label">Owner ID / Company Reg No.</label>
            <input name="ownerIdOrCompanyRegNumber" className="input" />
          </div>
          <div>
            <label className="label">Municipal Registration Status *</label>
            <select name="municipalRegistrationStatus" required className="input">
              <option value="REGISTERED">Registered</option>
              <option value="PENDING">Pending</option>
              <option value="UNREGISTERED">Unregistered</option>
              <option value="UNKNOWN">Unknown / Not yet checked</option>
            </select>
          </div>
          <div>
            <label className="label">Municipal Registration Number</label>
            <input name="municipalRegistrationNumber" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Registration Notes</label>
            <textarea name="registrationNotes" rows={2} className="input" />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : "Save Store & Continue to Assessment →"}
      </button>
    </form>
  );
}
