"use client";

import { useState, useRef } from "react";

type Props = {
  label: string;
  hint?: string;
  url: string | null;
  onChange: (url: string | null) => void;
  /** agency-only download; still show link when url set */
  accept?: string;
  /**
   * Owner documents (ID copies, consent forms, registration papers): the file is
   * encrypted before it is stored and can only be opened through the
   * authenticated download route, never through a direct link.
   */
  sensitive?: boolean;
  /** Authenticated link to open a saved sensitive document (only set once it is saved). */
  viewHref?: string | null;
};

export default function DocumentUploader({
  label,
  hint,
  url,
  onChange,
  accept = "image/*,application/pdf",
  sensitive = false,
  viewHref = null,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(files: FileList | null) {
    if (!files?.[0]) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", files[0]);
    if (sensitive) formData.append("sensitive", "true");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else if (data.url) {
        onChange(data.url);
      }
    } catch {
      setError("Network error while uploading");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const isPdf = url?.toLowerCase().includes(".pdf") || url?.includes("application/pdf");
  // An encrypted file can't be previewed from its storage link, so sensitive
  // documents never use the direct URL for a link or an image preview.
  const openHref = sensitive ? viewHref : url;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
          {url ? "🔄 Replace file" : "📎 Upload file"}
          <input
            ref={inputRef}
            type="file"
            accept={sensitive ? "application/pdf,image/jpeg,image/png,image/webp,image/heic" : accept}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files)}
          />
        </label>
        {url && (
          <>
            {openHref ? (
              <a
                href={openHref}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-700 font-medium hover:underline"
              >
                {!sensitive && isPdf ? "Open / download PDF" : "View / download"}
              </a>
            ) : (
              <span className="text-xs text-green-700">
                ✓ Uploaded securely. You can open it after saving.
              </span>
            )}
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </>
        )}
      </div>
      {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {sensitive && (
        <p className="text-xs text-gray-400 mt-1">
          🔒 Stored encrypted. Only admins, and the agent who captured this store, can open it.
        </p>
      )}
      {url && !sensitive && !isPdf && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 h-24 object-contain rounded border border-gray-200" />
      )}
    </div>
  );
}
