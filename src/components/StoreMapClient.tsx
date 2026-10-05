"use client";

import dynamic from "next/dynamic";
import type { MapStore } from "./StoreMap";

// Leaflet touches `window` at import time, so it can only ever render on the
// client. ssr:false is only allowed inside a Client Component, hence this
// tiny wrapper file.
const StoreMap = dynamic(() => import("./StoreMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 flex items-center justify-center text-sm text-gray-400 bg-brand-50 rounded-xl border border-dashed border-gray-200">
      Loading map…
    </div>
  ),
});

export default function StoreMapClient({ stores }: { stores: MapStore[] }) {
  return <StoreMap stores={stores} />;
}
