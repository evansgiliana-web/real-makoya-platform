"use client";

import { useState, useRef } from "react";

type Props = {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
};

export default function ImageUploader({ label, urls, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);

    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
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
      onChange([...urls, ...uploaded]);
    }
    setUploading(false);
    // reset inputs so the same file can be re-selected
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
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
          📁 Choose photos
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
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
        <div className="grid grid-cols-4 gap-2 mt-2">
          {urls.map((url, i) => (
            <div key={url + i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-20 w-full object-cover rounded-lg border border-gray-200"
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
