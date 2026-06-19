import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { snapToRoadBatch } from "@/lib/geo";
import { Icon } from "@/components/jk/Icon";

const mapContainerStyle: React.CSSProperties = {
  isolation: "isolate",
};

export interface BatchPhotoLocation {
  index: number;
  lat: number;
  lng: number;
  label: string;
}

interface BatchMapPreviewProps {
  locations: BatchPhotoLocation[];
}

export function BatchMapPreview({ locations }: BatchMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Layer[]>([]);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const isImportingRef = useRef(false);
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const snappedLocationsRef = useRef<BatchPhotoLocation[] | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function syncMarkers(L: typeof import("leaflet"), map: import("leaflet").Map) {
    const snapped = snappedLocationsRef.current;
    const current = snapped ?? locationsRef.current;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (current.length === 0) return;

    markersRef.current = current.map((loc) => {
      const icon = L.divIcon({
        html: `<div style="
          background:#1A4F8A; color:white; border-radius:50%;
          width:26px; height:26px; display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:700; border:2px solid #0F3260;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
        ">${loc.index + 1}</div>`,
        className: "",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([loc.lat, loc.lng], { icon });
      marker.bindTooltip(`#${loc.index + 1}: ${loc.label}`, { direction: "top" });
      marker.addTo(map);
      return marker;
    });

    const group = L.featureGroup(markersRef.current);
    map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16, animate: false });
  }

  useEffect(() => {
    if (!mapRef.current || locations.length === 0) return;

    snappedLocationsRef.current = null;

    const canceled = { current: false };

    if (online) {
      snapToRoadBatch(locations.map((l) => ({ lat: l.lat, lng: l.lng }))).then((snapped) => {
        if (canceled.current) return;
        const currentLocs = locationsRef.current;
        if (currentLocs.length !== snapped.length) return;
        snappedLocationsRef.current = currentLocs.map((l, i) => ({
          ...l,
          lat: snapped[i].lat,
          lng: snapped[i].lng,
        }));
        if (mapInstanceRef.current && LRef.current) {
          syncMarkers(LRef.current, mapInstanceRef.current);
        }
      });
    }

    if (mapInstanceRef.current && LRef.current) {
      syncMarkers(LRef.current, mapInstanceRef.current);
      return;
    }

    if (isImportingRef.current) return;
    isImportingRef.current = true;

    import("leaflet").then((L) => {
      isImportingRef.current = false;
      if (!mapRef.current || mapInstanceRef.current) return;
      LRef.current = L;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const current = locationsRef.current;
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: online,
      }).setView([current[0].lat, current[0].lng], 14);

      if (online) {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
      }

      mapInstanceRef.current = map;
      syncMarkers(L, map);
    });

    return () => {
      canceled.current = true;
      isImportingRef.current = false;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      LRef.current = null;
    };
  }, [locations, online]);

  return (
    <div className="w-full h-[220px] rounded-xl overflow-hidden border border-border-subtle relative" style={mapContainerStyle}>
      <div ref={mapRef} className="w-full h-full" />
      {!online && locations.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 pointer-events-none">
          <div className="bg-white/90 rounded-lg px-4 py-3 flex flex-col items-center gap-1 shadow-sm">
            <Icon name="map" className="text-on-surface-variant !text-[20px]" />
            <p className="text-[11px] text-on-surface-variant font-medium">Peta tidak tersedia</p>
            <p className="text-[10px] text-on-surface-variant">Tampilan akan muncul saat online</p>
          </div>
        </div>
      )}
    </div>
  );
}
