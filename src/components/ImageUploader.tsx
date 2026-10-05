"use client";

import { useState } from "react";

type Props = {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
};

export default function ImageUploader({ label, urls, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);

    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        setError("One or more photos failed to upload.");
        continue;
      }
      const data = await res.json();
      uploaded.push(data.url);
    }

    onChange([...urls, ...uploaded]);
    setUploading(false);
  }

  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:text-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-brand-800"
      />
      {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {urls.map((url, i) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-full object-cover rounded-lg border border-gray-200" />
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
