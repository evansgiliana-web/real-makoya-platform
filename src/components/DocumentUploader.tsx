"use client";

import { useState, useRef } from "react";

type Props = {
  label: string;
  hint?: string;
  url: string | null;
  onChange: (url: string | null) => void;
  /** agency-only download; still show link when url set */
  accept?: string;
};

export default function DocumentUploader({
  label,
  hint,
  url,
  onChange,
  accept = "image/*,application/pdf",
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
            accept={accept}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files)}
          />
        </label>
        {url && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-700 font-medium hover:underline"
            >
              {isPdf ? "Open / download PDF" : "View / download"}
            </a>
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
      {url && !isPdf && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 h-24 object-contain rounded border border-gray-200" />
      )}
    </div>
  );
}
