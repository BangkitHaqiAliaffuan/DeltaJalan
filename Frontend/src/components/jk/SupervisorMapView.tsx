import { useEffect, useRef, useState } from "react";
import type { Laporan } from "@/types/laporan";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 11;

const STATUS_COLORS: Record<string, string> = {
  "Menunggu Review": "#1A4F8A",
  Ditinjau: "#0284C7",
  Disetujui: "#16A34A",
  Ditolak: "#DC2626",
  "Sedang Diperbaiki": "#EA580C",
  Selesai: "#6B7280",
  Diedit: "#7C3AED",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#6B7280";
}

function getSeverityLabel(severity?: string | null): string {
  if (!severity) return "";
  const map: Record<string, string> = {
    berat: "Berat",
    sedang: "Sedang",
    ringan: "Ringan",
    "Rusak Berat": "Berat",
    "Rusak Sedang": "Sedang",
    "Rusak Ringan": "Ringan",
  };
  return map[severity] ?? severity;
}

interface SupervisorMapViewProps {
  reports: Laporan[];
}

export function SupervisorMapView({ reports }: SupervisorMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const validReports = reports.filter((r) => r.latitude && r.longitude);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    import("leaflet").then((L) => {
      if (!mapContainerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      if (validReports.length === 0) return;

      const markers: import("leaflet").Marker[] = [];

      validReports.forEach((r) => {
        const color = getStatusColor(r.status);
        const severityLabel = getSeverityLabel(r.overall_severity ?? r.ai_severity);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 28px; height: 36px;
              position: relative;
            ">
              <div style="
                width: 24px; height: 24px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              "></div>
            </div>
          `,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });

        const marker = L.marker([r.latitude!, r.longitude!], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:'Inter',sans-serif;min-width:180px;">
              <p style="font-weight:600;color:#0F172A;margin:0 0 2px;">${r.report_code}</p>
              <p style="color:#475569;font-size:12px;margin:0 0 2px;">${r.road_name}</p>
              <p style="color:#64748B;font-size:11px;margin:0 0 4px;">Kec. ${r.district}</p>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="display:inline-block;background:${color}20;color:${color};border:1px solid ${color}40;border-radius:9999px;padding:0 8px;font-size:10px;font-weight:500;">${r.status}</span>
                ${severityLabel ? `<span style="display:inline-block;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;border-radius:9999px;padding:0 8px;font-size:10px;font-weight:500;">${severityLabel}</span>` : ""}
              </div>
              <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#64748B;">
                <span>Skor: ${r.trust_score ?? "—"}</span>
                <span>|</span>
                <span>${new Date(r.created_at).toLocaleDateString("id-ID")}</span>
              </div>
            </div>`,
            { maxWidth: 240 },
          );

        markers.push(marker);
      });

      if (markers.length === 1) {
        map.setView([validReports[0].latitude!, validReports[0].longitude!], 15);
      } else {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13 });
      }
    });
  }, [validReports, mapReady]);

  if (validReports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#64748B]">
        <span className="text-5xl opacity-20 mb-3 material-symbols-rounded">map</span>
        <p className="text-[14px]">Tidak ada laporan dengan koordinat untuk ditampilkan</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#E2E8F0]">
      <div
        ref={mapContainerRef}
        style={{ height: 400, width: "100%" }}
        aria-label="Peta semua laporan aktif"
      />
      <div className="absolute bottom-2 right-2 z-[999] bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 flex flex-col gap-1 shadow-sm text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#1A4F8A] border border-white" />
          <span>Menunggu Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#0284C7] border border-white" />
          <span>Ditinjau</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#16A34A] border border-white" />
          <span>Disetujui</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#EA580C] border border-white" />
          <span>Sedang Diperbaiki</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#DC2626] border border-white" />
          <span>Ditolak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#6B7280] border border-white" />
          <span>Selesai</span>
        </div>
      </div>
    </div>
  );
}
