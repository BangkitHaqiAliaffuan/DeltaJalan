import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface DistrictStat {
  district: string;
  total: number;
  rusak_ringan: number;
  rusak_sedang: number;
  rusak_berat: number;
}

interface RecentMarker {
  latitude: number;
  longitude: number;
  overall_severity: string | null;
  status: string;
  district: string;
}

interface MapOverviewData {
  district_stats: DistrictStat[];
  recent_markers: RecentMarker[];
}

interface LandingMapPreviewProps {
  data?: MapOverviewData;
  height?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  "Rusak Berat": "#E11D48",
  "Rusak Sedang": "#F97316",
  "Rusak Ringan": "#F59E0B",
  Baik: "#10B981",
};

function getSeverityColor(severity: string | null): string {
  return SEVERITY_COLORS[severity ?? ""] ?? "#94a3b8";
}

function getDensityColor(count: number, maxCount: number): string {
  if (maxCount === 0) return "#D1FAE5";
  const ratio = count / maxCount;
  if (ratio === 0) return "#D1FAE5";
  if (ratio < 0.1) return "#BBF7D0";
  if (ratio < 0.25) return "#FEF08A";
  if (ratio < 0.5) return "#FDE047";
  if (ratio < 0.75) return "#F97316";
  return "#EF4444";
}

export default function LandingMapPreview({
  data,
  height = "350px",
}: LandingMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    import("leaflet").then((L) => {
      if (cancelled) return;
      if (mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(el, {
        center: [-7.4478, 112.7183],
        zoom: 11,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        dragging: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      LRef.current = L;
      mapInstanceRef.current = map;
      setLoading(false);

      const statsMap = new Map<string, number>();
      let maxCount = 0;
      if (data?.district_stats) {
        for (const s of data.district_stats) {
          statsMap.set(s.district, s.total);
          if (s.total > maxCount) maxCount = s.total;
        }
      }

      fetch("/data/sidoarjo-kecamatan.geojson")
        .then((r) => r.json())
        .then((geoJson) => {
          if (cancelled) return;
          const geoLayer = L.geoJSON(geoJson, {
            style: (feature) => {
              const kecName = feature?.properties?.kecamatan ?? feature?.properties?.name ?? "";
              const count = statsMap.get(kecName) ?? 0;
              return {
                fillColor: getDensityColor(count, maxCount),
                fillOpacity: 0.5,
                color: "#6366f1",
                weight: 1.5,
                opacity: 0.6,
              };
            },
          });
          geoLayer.addTo(map);
        })
        .catch(() => {});

      if (data?.recent_markers) {
        for (const m of data.recent_markers) {
          const color = getSeverityColor(m.overall_severity);
          L.circleMarker([m.latitude, m.longitude], {
            radius: 6,
            fillColor: color,
            color: "#ffffff",
            weight: 2,
            fillOpacity: 0.85,
          })
            .bindTooltip(
              `${m.district} — ${m.overall_severity ?? m.status}`,
              { direction: "top" },
            )
            .addTo(map);
        }
      }
    });

    return () => {
      cancelled = true;
      const m = mapInstanceRef.current;
      if (m) {
        const pane = (m as any)._panes?.mapPane;
        if (pane) pane.style.transition = "none";
        m.remove();
      }
      mapInstanceRef.current = null;
      LRef.current = null;
    };
  }, [data]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#e0e7ff] shadow-sm">
      {loading && (
        <div
          className="absolute inset-0 bg-slate-100 flex items-center justify-center z-10 rounded-xl"
          style={{ height }}
        >
          <span className="w-6 h-6 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full rounded-xl"
        style={{ height }}
      />
    </div>
  );
}
