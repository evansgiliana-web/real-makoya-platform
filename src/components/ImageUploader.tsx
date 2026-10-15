"use client";

import { useState, useRef } from "react";

type Props = {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  /** Max number of images (default unlimited). Use 1 for labelled slots. */
  maxCount?: number;
};

export default function ImageUploader({ label, urls, onChange, maxCount }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const atLimit = maxCount != null && urls.length >= maxCount;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);

    const room = maxCount != null ? Math.max(0, maxCount - urls.length) : files.length;
    const list = Array.from(files).slice(0, room || 1);

    // Single-slot replace: clear previous when maxCount is 1
    const base = maxCount === 1 ? [] : urls;

    const uploaded: string[] = [];
    for (const file of list) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "One or more photos failed to upload.");
          continue;
        }
        if (data.url) uploaded.push(data.url);
      } catch {
        setError("Network error while uploading. Check your connection and try again.");
      }
    }

    if (uploaded.length > 0) {
      const next = maxCount === 1 ? uploaded.slice(0, 1) : [...base, ...uploaded];
      onChange(maxCount != null ? next.slice(0, maxCount) : next);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        <label
          className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer ${
            atLimit && maxCount !== 1 ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {maxCount === 1 && urls.length > 0 ? "🔄 Replace photo" : "📁 Choose photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple={maxCount !== 1}
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
        <label
          className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer ${
            atLimit && maxCount !== 1 ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          📷 Take photo
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>
      {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {urls.length > 0 && (
        <div className={`grid gap-2 mt-2 ${maxCount === 1 ? "grid-cols-1 max-w-[200px]" : "grid-cols-4"}`}>
          {urls.map((url, i) => (
            <div key={url + i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-28 w-full object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs leading-5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
