import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface DistrictStat {
  district: string;
  total: number;
  rusak_ringan: number;
  rusak_sedang: number;
  rusak_berat: number;
  avg_severity_score: number;
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

const MARKER_SEVERITY_COLORS: Record<string, string> = {
  "Rusak Berat": "#E11D48",
  "Rusak Sedang": "#F97316",
  "Rusak Ringan": "#F59E0B",
  Baik: "#10B981",
};

const POLYGON_SEVERITY_COLORS: Record<string, string> = {
  berat: "#E11D48",
  sedang: "#F97316",
  ringan: "#F59E0B",
  baik: "#2E7D32",
};

function getMarkerColor(severity: string | null): string {
  return MARKER_SEVERITY_COLORS[severity ?? ""] ?? "#94a3b8";
}

function severityScoreToKey(score: number): string {
  if (score >= 2.5) return "berat";
  if (score >= 1.5) return "sedang";
  if (score >= 0.5) return "ringan";
  return "baik";
}

function getPolygonColor(score: number): string {
  const key = severityScoreToKey(score);
  return POLYGON_SEVERITY_COLORS[key] ?? "#94a3b8";
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

      const statsByDistrict = new Map<string, DistrictStat>();
      if (data?.district_stats) {
        for (const s of data.district_stats) {
          statsByDistrict.set(s.district, s);
        }
      }

      fetch("/data/sidoarjo-kecamatan.geojson")
        .then((r) => r.json())
        .then((geoJson) => {
          if (cancelled) return;
          const geoLayer = L.geoJSON(geoJson, {
            style: (feature) => {
              const kecName = feature?.properties?.kecamatan ?? feature?.properties?.name ?? "";
              const ds = statsByDistrict.get(kecName);
              const score = ds ? ds.avg_severity_score : 0;
              return {
                fillColor: getPolygonColor(score),
                fillOpacity: 0.3,
                color: getPolygonColor(score),
                weight: 2,
                opacity: 0.8,
              };
            },
          });
          geoLayer.addTo(map);
        })
        .catch(() => {});

      if (data?.recent_markers) {
        for (const m of data.recent_markers) {
          const color = getMarkerColor(m.overall_severity);
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
