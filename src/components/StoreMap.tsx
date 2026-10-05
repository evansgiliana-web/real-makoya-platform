"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

import "leaflet/dist/leaflet.css";
import Link from "next/link";

export type MapStore = {
  id: string;
  name: string;
  town: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  riskLevel?: string;
};

const riskColor: Record<string, string> = {
  NONE: "#16a34a",
  LOW: "#ca8a04",
  MEDIUM: "#ea580c",
  HIGH: "#dc2626",
  CONFIRMED_COUNTERFEIT: "#991b1b",
};

export default function StoreMap({ stores, zoom }: { stores: MapStore[]; zoom?: number }) {
  const pinned = stores.filter((s) => s.latitude != null && s.longitude != null);

  if (pinned.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-sm text-gray-400 bg-brand-50 rounded-xl border border-dashed border-gray-200">
        No GPS location captured for this store yet.
      </div>
    );
  }

  const center: [number, number] = [pinned[0].latitude as number, pinned[0].longitude as number];
  const resolvedZoom = zoom ?? (pinned.length === 1 ? 15 : 11);

  return (
    <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={resolvedZoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.latitude as number, s.longitude as number]}
            radius={8}
            pathOptions={{
              color: riskColor[s.riskLevel || "NONE"] || "#0f4c3a",
              fillColor: riskColor[s.riskLevel || "NONE"] || "#0f4c3a",
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{s.name}</p>
                <p className="text-gray-500">
                  {s.town}, {s.province}
                </p>
                <Link href={`/dashboard/stores/${s.id}`} className="text-brand-700 font-medium">
                  View store →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
