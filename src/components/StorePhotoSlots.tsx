"use client";

import ImageUploader from "./ImageUploader";
import {
  STORE_PHOTO_SLOTS,
  type SlotPhotoMap,
  type StorePhotoSlotKey,
} from "@/lib/photoSlots";

type Props = {
  value: SlotPhotoMap;
  onChange: (next: SlotPhotoMap) => void;
  /** When true, required slots must be filled before parent submits (parent validates). */
  showRequiredHint?: boolean;
};

export default function StorePhotoSlots({ value, onChange, showRequiredHint = true }: Props) {
  function setSlot(key: StorePhotoSlotKey, urls: string[]) {
    const url = urls[0] || undefined;
    const next = { ...value };
    if (url) next[key] = url;
    else delete next[key];
    onChange(next);
  }

  const missing = STORE_PHOTO_SLOTS.filter((s) => s.required && !value[s.key]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-brand-900">Store photo checklist</h2>
        <p className="text-xs text-gray-500 mt-1">
          Capture one clear photo per slot. Required slots are marked with *.
        </p>
        {showRequiredHint && missing.length > 0 && (
          <p className="text-xs text-amber-700 mt-1">
            Still needed: {missing.map((m) => m.label).join(", ")}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {STORE_PHOTO_SLOTS.map((slot) => (
          <div
            key={slot.key}
            className="rounded-lg border border-gray-100 bg-gray-50/50 p-3"
          >
            <ImageUploader
              label={`${slot.label}${slot.required ? " *" : ""}`}
              urls={value[slot.key] ? [value[slot.key]!] : []}
              onChange={(urls) => setSlot(slot.key, urls)}
              maxCount={1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
