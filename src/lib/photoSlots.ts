/** Standard labelled photo slots for spaza store capture (Phase 2). */
export const STORE_PHOTO_SLOTS = [
  { key: "SHOP_FRONT", label: "1. Shop front", required: true },
  { key: "STREET_NAME", label: "2. Street name", required: true },
  { key: "STORE_SHELVES", label: "3. Store shelves", required: true },
  { key: "CUSTOMER_SERVICE", label: "4. Customer service point", required: true },
  { key: "STORAGE_AREA", label: "5. Storage area", required: true },
  { key: "POINT_OF_SALE", label: "6. Point of sale", required: true },
] as const;

export type StorePhotoSlotKey = (typeof STORE_PHOTO_SLOTS)[number]["key"];

export type SlotPhotoMap = Partial<Record<StorePhotoSlotKey, string>>;

export function slotLabel(key: string): string {
  const found = STORE_PHOTO_SLOTS.find((s) => s.key === key);
  return found?.label ?? key;
}

/** Order images for display: known slots first, then any extras. */
export function sortImagesBySlot<T extends { category: string }>(images: T[]): T[] {
  const order = new Map<string, number>(
    STORE_PHOTO_SLOTS.map((s, i) => [s.key as string, i])
  );
  return [...images].sort((a, b) => {
    const ai = order.has(a.category) ? order.get(a.category)! : 999;
    const bi = order.has(b.category) ? order.get(b.category)! : 999;
    return ai - bi;
  });
}