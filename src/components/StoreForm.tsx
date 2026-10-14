"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";

type StoreInitial = {
  id: string;
  name: string;
  tradingAs?: string | null;
  address: string;
  town: string;
  province: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerName: string;
  ownerContactNumber?: string | null;
  ownerIdOrCompanyRegNumber?: string | null;
  municipalRegistrationStatus: string;
  municipalRegistrationNumber?: string | null;
  registrationNotes?: string | null;
  storeTelephoneNumber?: string | null;
  storePhotoUrls?: string[];
  ownerConsentGiven?: boolean;
  visitCadenceDays?: number;
  nextVisitDue?: string | null;
  piiRedacted?: boolean;
};

type Props = {
  initial?: StoreInitial;
};

export default function StoreForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { lat: initial.latitude, lng: initial.longitude }
      : null
  );
  const [geoStatus, setGeoStatus] = useState(
    initial?.latitude != null
      ? `Saved: ${initial.latitude.toFixed(5)}, ${initial.longitude?.toFixed(5)}`
      : ""
  );
  const [storePhotos, setStorePhotos] = useState<string[]>(initial?.storePhotoUrls || []);
  const [consent, setConsent] = useState(Boolean(initial?.ownerConsentGiven));

  function captureLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation isn't supported on this device/browser.");
      return;
    }
    setGeoStatus("Getting location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus(
          `Captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        );
      },
      () => setGeoStatus("Could not get location — check location permission for this site."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

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
      storeTelephoneNumber: form.get("storeTelephoneNumber") || undefined,
      latitude: coords?.lat ?? undefined,
      longitude: coords?.lng ?? undefined,
      storePhotoUrls: storePhotos,
      ownerConsentGiven: consent,
      visitCadenceDays: Number(form.get("visitCadenceDays") || 90),
      nextVisitDue: (form.get("nextVisitDue") as string) || undefined,
    };

    const url = isEdit ? `/api/stores/${initial!.id}` : "/api/stores";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        typeof data.error === "string"
          ? data.error
          : "Could not save store. Please check the required fields."
      );
      return;
    }

    const store = await res.json();
    if (isEdit) {
      router.push(`/dashboard/stores/${store.id}`);
      router.refresh();
    } else {
      router.push(`/dashboard/stores/${store.id}/assess`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6 max-w-2xl">
      <section>
        <h2 className="font-semibold text-brand-900 mb-3">Store Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Store Name *</label>
            <input name="name" required className="input" defaultValue={initial?.name || ""} />
          </div>
          <div className="col-span-2">
            <label className="label">Trading As (if different)</label>
            <input name="tradingAs" className="input" defaultValue={initial?.tradingAs || ""} />
          </div>
          <div className="col-span-2">
            <label className="label">Address *</label>
            <input name="address" required className="input" defaultValue={initial?.address || ""} />
          </div>
          <div>
            <label className="label">Town *</label>
            <input name="town" required className="input" defaultValue={initial?.town || ""} />
          </div>
          <div>
            <label className="label">Province *</label>
            <input
              name="province"
              required
              className="input"
              defaultValue={initial?.province || ""}
            />
          </div>
          <div>
            <label className="label">Store Telephone Number</label>
            <input
              name="storeTelephoneNumber"
              className="input"
              placeholder="e.g. 011 234 5678"
              defaultValue={initial?.storeTelephoneNumber || ""}
              disabled={initial?.piiRedacted}
            />
          </div>
          <div>
            <label className="label">GPS Location</label>
            <button type="button" onClick={captureLocation} className="btn-secondary w-full text-sm">
              📍 Capture current location
            </button>
            {geoStatus && <p className="text-xs text-gray-500 mt-1">{geoStatus}</p>}
          </div>
          <div className="col-span-2">
            <ImageUploader
              label="Store Photos (storefront, signage, interior)"
              urls={storePhotos}
              onChange={setStorePhotos}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <h2 className="font-semibold text-brand-900 mb-3">Ownership & Registration</h2>
        {initial?.piiRedacted && (
          <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Owner PII has been redacted on this store. Contact fields are cleared and cannot be
            restored from the app.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Owner Name *</label>
            <input
              name="ownerName"
              required
              className="input"
              defaultValue={initial?.ownerName || ""}
            />
          </div>
          <div>
            <label className="label">Owner Contact Number</label>
            <input
              name="ownerContactNumber"
              className="input"
              defaultValue={initial?.ownerContactNumber || ""}
              disabled={initial?.piiRedacted}
            />
          </div>
          <div>
            <label className="label">Owner ID / Company Reg No.</label>
            <input
              name="ownerIdOrCompanyRegNumber"
              className="input"
              defaultValue={initial?.ownerIdOrCompanyRegNumber || ""}
              disabled={initial?.piiRedacted}
            />
          </div>
          <div>
            <label className="label">Municipal Registration Status *</label>
            <select
              name="municipalRegistrationStatus"
              required
              className="input"
              defaultValue={initial?.municipalRegistrationStatus || "UNKNOWN"}
            >
              <option value="REGISTERED">Registered</option>
              <option value="PENDING">Pending</option>
              <option value="UNREGISTERED">Unregistered</option>
              <option value="UNKNOWN">Unknown / Not yet checked</option>
            </select>
          </div>
          <div>
            <label className="label">Municipal Registration Number</label>
            <input
              name="municipalRegistrationNumber"
              className="input"
              defaultValue={initial?.municipalRegistrationNumber || ""}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Registration Notes</label>
            <textarea
              name="registrationNotes"
              rows={2}
              className="input"
              defaultValue={initial?.registrationNotes || ""}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <h2 className="font-semibold text-brand-900 mb-3">Visit Cadence</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Revisit every (days)</label>
            <input
              name="visitCadenceDays"
              type="number"
              min={7}
              max={365}
              className="input"
              defaultValue={initial?.visitCadenceDays ?? 90}
            />
          </div>
          <div>
            <label className="label">Next visit due</label>
            <input
              name="nextVisitDue"
              type="date"
              className="input"
              defaultValue={
                initial?.nextVisitDue
                  ? new Date(initial.nextVisitDue).toISOString().slice(0, 10)
                  : ""
              }
            />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <h2 className="font-semibold text-brand-900 mb-3">POPIA Consent</h2>
        <p className="text-sm text-gray-600 mb-3">
          South African law (POPIA) requires informed consent before collecting and storing a
          shop owner&apos;s ID number or personal contact details. This data may later be shared
          with FMCG partners under your agency agreements.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
            required={!initial?.ownerConsentGiven}
          />
          <span className="text-sm text-gray-800">
            I confirm the store owner (or authorised representative) has given informed consent
            for Real Makoya Agency to collect, store, and share their identity and contact
            details for retail audit and compliance purposes. *
          </span>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading
          ? "Saving…"
          : isEdit
            ? "Save changes"
            : "Save Store & Continue to Assessment →"}
      </button>
    </form>
  );
}
