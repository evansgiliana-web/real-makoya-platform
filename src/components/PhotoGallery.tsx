"use client";

import { useEffect, useState } from "react";
import { slotLabel } from "@/lib/photoSlots";

export type GalleryItem = {
  url: string;
  label: string;
  category?: string;
};

type Props = {
  items: GalleryItem[];
  title?: string;
  emptyMessage?: string;
};

export default function PhotoGallery({
  items,
  title = "Store photos",
  emptyMessage = "No photos captured yet.",
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight" && openIndex != null) {
        setOpenIndex((i) => (i == null ? i : (i + 1) % items.length));
      }
      if (e.key === "ArrowLeft" && openIndex != null) {
        setOpenIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-brand-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  const current = openIndex != null ? items[openIndex] : null;

  return (
    <div className="card p-6 mb-6">
      <h2 className="font-semibold text-brand-900 mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <button
            key={item.url + i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="text-left group focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg"
          >
            <p className="text-xs font-medium text-gray-600 mb-1 truncate">
              {item.label || slotLabel(item.category || "")}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.label}
              className="h-32 w-full object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition"
            />
            <p className="text-[11px] text-gray-400 mt-1">Click to enlarge</p>
          </button>
        ))}
      </div>

      {current && openIndex != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-2 text-white">
              <p className="text-sm font-medium truncate">
                {current.label} ({openIndex + 1}/{items.length})
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
                >
                  Open
                </a>
                <a
                  href={current.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setOpenIndex(null)}
                  className="rounded bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
                >
                  Close
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.label}
              className="max-h-[80vh] w-full object-contain rounded-lg bg-black"
            />
            {items.length > 1 && (
              <div className="flex justify-between mt-3">
                <button
                  type="button"
                  className="rounded bg-white/15 text-white px-3 py-1.5 text-sm"
                  onClick={() =>
                    setOpenIndex((openIndex - 1 + items.length) % items.length)
                  }
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="rounded bg-white/15 text-white px-3 py-1.5 text-sm"
                  onClick={() => setOpenIndex((openIndex + 1) % items.length)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
