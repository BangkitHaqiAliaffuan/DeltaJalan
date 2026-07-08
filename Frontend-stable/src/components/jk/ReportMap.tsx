import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const mapContainerStyle: React.CSSProperties = {
  isolation: "isolate",
};

export interface ReportMapPoint {
  label: string;
  lat: number;
  lng: number;
  imageUrl?: string | null;
  reportCode?: string;
}

interface ReportMapProps {
  points: ReportMapPoint[];
  height?: string;
  onPointClick?: (point: ReportMapPoint) => void;
}

export function ReportMap({ points, height = "220px", onPointClick }: ReportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Layer[]>([]);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const isImportingRef = useRef(false);
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  function syncMarkers(L: typeof import("leaflet"), map: import("leaflet").Map) {
    const current = pointsRef.current;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (current.length === 0) return;

    const hasMultiple = current.length > 1;

    markersRef.current = current.map((pt) => {
      const idx = current.indexOf(pt) + 1;
      const color = hasMultiple ? "#1A4F8A" : "#DC2626";
      const size = hasMultiple ? 26 : 32;
      const html = hasMultiple
        ? `<div style="background:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #0F3260;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${idx}</div>`
        : `<div style="background:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid #991B1B;box-shadow:0 1px 4px rgba(0,0,0,0.3);">📍</div>`;

      const icon = L.divIcon({
        html,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([pt.lat, pt.lng], { icon });

      // Tooltip pada hover
      let tooltipLabel = hasMultiple ? `#${idx}: ` : "";
      tooltipLabel += pt.label;
      if (pt.reportCode) tooltipLabel += ` (${pt.reportCode})`;
      marker.bindTooltip(tooltipLabel, { direction: "top" });

      // Popup pada klik — tampilkan koordinat
      const coordText = `${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`;
      const popupHtml = `
        <div style="font-size:12px;line-height:1.5;min-width:140px">
          <p style="font-weight:600;margin:0 0 4px">${tooltipLabel}</p>
          <p style="font-family:monospace;font-size:11px;color:#666;margin:0 0 4px">${coordText}</p>
          <a href="https://www.google.com/maps?q=${pt.lat},${pt.lng}" target="_blank" style="font-size:11px;color:#2563EB;text-decoration:underline" rel="noopener noreferrer">Buka di Google Maps</a>
        </div>
      `;
      marker.bindPopup(popupHtml, { closeButton: true, maxWidth: 260 });

      if (onPointClick) {
        marker.on("click", () => onPointClick(pt));
      }

      marker.addTo(map);
      return marker;
    });

    if (current.length === 1) {
      map.setView([current[0].lat, current[0].lng], 16);
    } else {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16, animate: false });
    }
  }

  useEffect(() => {
    let canceled = false;

    if (!mapRef.current || points.length === 0) return;

    if (mapInstanceRef.current && LRef.current) {
      syncMarkers(LRef.current, mapInstanceRef.current);
      return;
    }

    if (isImportingRef.current) return;
    isImportingRef.current = true;

    import("leaflet").then((L) => {
      isImportingRef.current = false;
      if (canceled) return;
      if (!mapRef.current || mapInstanceRef.current) return;
      LRef.current = L;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const first = pointsRef.current[0];
      const map = L.map(mapRef.current, { zoomControl: false }).setView([first.lat, first.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      syncMarkers(L, map);
    });

    return () => {
      canceled = true;
      isImportingRef.current = false;
      const m = mapInstanceRef.current;
      if (m) {
        const pane = (m as any)._panes?.mapPane;
        if (pane) {
          pane.style.transition = "none";
        }
        m.remove();
      }
      mapInstanceRef.current = null;
      LRef.current = null;
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        className="w-full rounded-xl overflow-hidden border border-border-subtle bg-slate-50 flex items-center justify-center"
        style={{ height, ...mapContainerStyle }}
      >
        <p className="text-xs text-slate-400">Tidak ada data koordinat</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-border-subtle"
      style={{ height, ...mapContainerStyle }}
    />
  );
}
