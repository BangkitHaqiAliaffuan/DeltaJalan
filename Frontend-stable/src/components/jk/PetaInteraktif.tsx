import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { LaporanMarker, DistrictSummary, MapStats } from "@/types/laporan";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const DEFAULT_CENTER: [number, number] = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 11;
const POLYGON_MIN_ZOOM = 10;
const POLYGON_MAX_ZOOM = 12;

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  berat: { color: "#E11D48", label: "Rusak Berat" },
  sedang: { color: "#F97316", label: "Rusak Sedang" },
  ringan: { color: "#F59E0B", label: "Rusak Ringan" },
  baik: { color: "#2E7D32", label: "Baik" },
};

const POLYGON_SEVERITY_COLORS: Record<string, string> = {
  berat: "#E11D48",
  sedang: "#F97316",
  ringan: "#F59E0B",
  baik: "#2E7D32",
};

const ALL_STATUSES = ["Ditinjau", "Disetujui", "Ditolak", "Sedang Diperbaiki", "Selesai", "Diedit"];

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  "Menunggu Review": { color: "#64748B", label: "Menunggu" },
  Ditinjau: { color: "#64748B", label: "Ditinjau" },
  Disetujui: { color: "#2563EB", label: "Disetujui" },
  "Sedang Diperbaiki": { color: "#D97706", label: "Diperbaiki" },
  Selesai: { color: "#16A34A", label: "Selesai" },
  Ditolak: { color: "#DC2626", label: "Ditolak" },
  Diedit: { color: "#6B7280", label: "Diedit" },
};

function getSeverityKey(r: LaporanMarker): string {
  const s = (r.overall_severity ?? r.ai_severity ?? "").toLowerCase();
  if (s.includes("berat")) return "berat";
  if (s.includes("sedang")) return "sedang";
  if (s.includes("ringan")) return "ringan";
  return "baik";
}

function getStatusBadgeHtml(status: string): string {
  const cfg = STATUS_BADGE[status];
  if (!cfg) return "";
  const dotColor = cfg.color;
  const isTerminal = status === "Selesai" || status === "Ditolak";
  const inner = isTerminal
    ? `<span style="color:white;font-size:7px;font-weight:700;line-height:1;">${status === "Selesai" ? "✓" : "✕"}</span>`
    : "";
  return `<div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${dotColor};border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${inner}</div>`;
}

function displayStatus(s: string): string {
  return s === "Ditinjau" ? "Menunggu Review" : s;
}

function formatAge(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hari ini";
    if (days === 1) return "1 hari lalu";
    if (days < 7) return `${days} hari lalu`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return "1 minggu lalu";
    return `${weeks} minggu lalu`;
  } catch {
    return dateStr;
  }
}

function severityScoreToKey(score: number): string {
  if (score >= 2.5) return "berat";
  if (score >= 1.5) return "sedang";
  if (score >= 0.5) return "ringan";
  return "baik";
}

export interface MapFilters {
  status: string[];
  severity: string[];
  district: string;
  uptd_id: string;
  deadline_hari: string;
  status_deadline: string;
}

interface PetaInteraktifProps {
  mapReports: LaporanMarker[];
  districtStats: Record<string, DistrictSummary>;
  mapStats: MapStats;
  teamList: { id: string; name: string; wilayah?: string; uptd?: { id: string; nama: string } }[];
  filters: MapFilters;
  onFilterChange: (filters: MapFilters) => void;
  onViewDetail?: (id: string) => void;
  userRole?: string;
  currentUserId?: number | string | null;
  highlightReportId?: string;
}

export function PetaInteraktif({
  mapReports,
  districtStats,
  mapStats,
  teamList,
  filters,
  onFilterChange,
  onViewDetail,
  userRole,
  currentUserId,
  highlightReportId,
}: PetaInteraktifProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const markerClusterRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const currentZoomRef = useRef(DEFAULT_ZOOM);
  const lastFittedDistrictRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoJsonLoading, setGeoJsonLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  const [isDesktop, setIsDesktop] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filterMinimized, setFilterMinimized] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // ── Responsive breakpoint ──
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      const desktop = e.matches;
      setIsDesktop(desktop);
      if (!desktop) setShowStats(false);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Dynamic Leaflet import (single chunk — leaflet + markercluster in one module) ──
  useEffect(() => {
    let cancelled = false;
    import("@/lib/leaflet-bundle").then((mod) => {
      if (cancelled) return;
      LRef.current = mod.default;
      setLeafletReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Active-only district severity (for polygon coloring) ──
  const activeDistrictStats = useMemo(() => {
    const activeReports = mapReports.filter(
      (r) => r.status !== "Selesai" && r.status !== "Ditolak",
    );
    const sums: Record<string, { total: number; score: number }> = {};
    activeReports.forEach((r) => {
      if (!r.district) return;
      if (!sums[r.district]) sums[r.district] = { total: 0, score: 0 };
      const sevKey = getSeverityKey(r);
      const numScore =
        sevKey === "berat" ? 3 : sevKey === "sedang" ? 2 : sevKey === "ringan" ? 1 : 0;
      sums[r.district].total++;
      sums[r.district].score += numScore;
    });
    const result: Record<string, DistrictSummary> = {};
    Object.entries(districtStats).forEach(([k, v]) => {
      const s = sums[k];
      result[k] = {
        ...v,
        avg_severity_score: s && s.total > 0 ? parseFloat((s.score / s.total).toFixed(2)) : 0,
      };
    });
    return result;
  }, [mapReports, districtStats]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Inject map popup CSS (hide default close button, smooth animations)
  useEffect(() => {
    const id = "map-popup-custom-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .leaflet-popup-close-button { display: none !important; }
      .leaflet-popup { transition: transform 0.25s ease, opacity 0.25s ease !important; }
      .leaflet-popup-content-wrapper { border-radius: 14px !important; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important; }
      .leaflet-popup-content { margin: 0 !important; }
      .leaflet-tooltip { background: #0F172A !important; color: white !important; border: none !important; border-radius: 10px !important; padding: 8px 12px !important; font-size: 12px !important; font-family: 'Inter', sans-serif !important; box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; }
      .leaflet-tooltip-top::before { border-top-color: #0F172A !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // Load GeoJSON static asset
  useEffect(() => {
    let cancelled = false;
    fetch("/data/sidoarjo-kecamatan.geojson")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setGeoJsonData(data);
          setGeoJsonLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setGeoJsonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable style function — reads districtStats and zoom from refs
  const styleFnRef = useRef<(feature: any) => Record<string, unknown>>((feature) => ({
    fillColor: "#94A3B8",
    fillOpacity: 0,
    weight: 0,
    opacity: 0,
  }));

  styleFnRef.current = useCallback(
    (feature: any) => {
      const kec = feature?.properties?.kecamatan ?? "";
      const ds = activeDistrictStats[kec];
      const score = ds ? ds.avg_severity_score : 0;
      const key = severityScoreToKey(score);
      const color = POLYGON_SEVERITY_COLORS[key] ?? "#94A3B8";
      const z = currentZoomRef.current;
      const show = z >= POLYGON_MIN_ZOOM && z < POLYGON_MAX_ZOOM;
      return {
        fillColor: color,
        fillOpacity: show ? 0.25 : 0,
        color: color,
        weight: show ? 2 : 0,
        opacity: show ? 0.8 : 0,
      };
    },
    [activeDistrictStats],
  );

  // ── Init Map ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const L = LRef.current;
    if (!L) return;

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

    map.on("zoomend", () => {
      const z = map.getZoom();
      currentZoomRef.current = z;
      setZoomLevel(z);
      if (polygonLayerRef.current) {
        polygonLayerRef.current.setStyle((feature) => styleFnRef.current(feature));
      }
      if (markerClusterRef.current && !map.hasLayer(markerClusterRef.current)) {
        map.addLayer(markerClusterRef.current);
      }
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      if (mapRef.current) {
        const m = mapRef.current;
        // Force-complete any in-progress CSS zoom transition so
        // Leaflet's internal _onZoomTransitionEnd doesn't fire
        // after the map container is removed from the DOM.
        const pane = (m as any)._panes?.mapPane;
        if (pane) {
          pane.style.transition = "none";
        }
        m.remove();
        mapRef.current = null;
        polygonLayerRef.current = null;
        markerClusterRef.current = null;
        markersRef.current = [];
      }
    };
  }, [leafletReady]);

  // ── Polygon Layer (created once, style updated via setStyle) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !geoJsonData) return;
    const L = LRef.current;
    if (!L) return;

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }

    const layer = L.geoJSON(geoJsonData, {
      style: (feature) => styleFnRef.current(feature),
      onEachFeature: (feature, layer) => {
        const kec = feature?.properties?.kecamatan ?? "";
        const ds = districtStats[kec];
        const activeDs = activeDistrictStats[kec];
        const activeTotal = activeDs?.total ?? 0;
        layer.bindPopup(
          `<div style="font-family:'Inter',sans-serif;min-width:200px;">
            <p style="font-weight:700;font-size:14px;color:#0F172A;margin:0 0 6px;">Kec. ${kec}</p>
            <div style="font-size:12px;color:#475569;">
              ${
                ds
                  ? `
                <p style="margin:3px 0;">Total laporan: <strong>${ds.total}</strong></p>
                <p style="margin:3px 0;"><span style="color:#E11D48;font-size:10px;">●</span> Rusak Berat: ${ds.rusak_berat}</p>
                <p style="margin:3px 0;"><span style="color:#F97316;font-size:10px;">●</span> Rusak Sedang: ${ds.rusak_sedang}</p>
                <p style="margin:3px 0;"><span style="color:#F59E0B;font-size:10px;">●</span> Rusak Ringan: ${ds.rusak_ringan}</p>
                <p style="margin:4px 0 0;padding-top:4px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">Laporan aktif: <strong>${activeTotal}</strong> (belum selesai)</p>
              `
                  : `<p style="margin:2px 0;">Tidak ada data laporan</p>`
              }
            </div>
          </div>`,
          { maxWidth: 280 },
        );
        layer.on("click", () => {
          if (filters.district !== kec) {
            onFilterChange({ ...filters, district: kec });
          }
        });
      },
    });

    map.addLayer(layer);
    polygonLayerRef.current = layer;
  }, [mapReady, geoJsonData]);

  // ── Re-style polygon when activeDistrictStats change ──
  useEffect(() => {
    if (!polygonLayerRef.current) return;
    polygonLayerRef.current.setStyle((feature) => styleFnRef.current(feature));
  }, [activeDistrictStats]);

  // ── MarkerCluster (created once, content updated via clearLayers) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const L = LRef.current;
    if (!L) return;

    // Create cluster group once (clustering disabled — all markers shown as pins)
    if (!markerClusterRef.current) {
      const mcg = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 1,
        disableClusteringAtZoom: 0,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      });
      map.addLayer(mcg);
      markerClusterRef.current = mcg;
    }

    // Register global view-detail & minimize handlers
    (window as any).__mapViewDetail = (id: string) => {
      if (onViewDetail) {
        onViewDetail(id);
      } else {
        window.location.href = `/detail-report?reportId=${id}`;
      }
    };
    (window as any).__minimizePopup = () => {
      map.closePopup();
    };

    const mcg = markerClusterRef.current;
    mcg.clearLayers();
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    map.closePopup();

    if (mapReports.length === 0) return;

    const markers: any[] = [];

    mapReports.forEach((r) => {
      if (!r.latitude || !r.longitude) return;
      const sevKey = getSeverityKey(r);
      const sevConf = SEVERITY_CONFIG[sevKey] ?? SEVERITY_CONFIG.baik;
      const status = displayStatus(r.status);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:36px;position:relative;">
            <div style="width:24px;height:24px;background:${sevConf.color};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
            ${getStatusBadgeHtml(r.status)}
          </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const photoHtml = r.first_photo_url
        ? `<div style="position:relative;height:116px;overflow:hidden;">
            <img src="${resolveImageUrl(r.first_photo_url) ?? ''}" loading="lazy" style="width:100%;height:116px;object-fit:cover;" alt="" />
            <div style="position:absolute;top:0;left:0;right:0;height:100%;background:linear-gradient(0deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.01) 50%,rgba(0,0,0,0.01) 100%);pointer-events:none;"></div>
            <div style="position:absolute;bottom:10px;left:12px;right:40px;">
              <p style="margin:0;font-size:15px;font-weight:700;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.4);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.road_name}</p>
            </div>
          </div>`
        : `<div style="height:80px;background:#F1F5F9;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg></div>`;

      const infoItems = [
        {
          icon: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
          label: r.district ?? "-",
        },
        {
          icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
          label: formatAge(r.created_at),
        },
      ];
      if (r.kerusakan_panjang != null && r.kerusakan_lebar != null) {
        infoItems.push({
          icon: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
          label: `${r.kerusakan_panjang}m × ${r.kerusakan_lebar}m`,
        });
      }
      if (r.assigned_team_name) {
        infoItems.push({
          icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
          label: r.assigned_team_name,
        });
      }

      const infoItemsHtml = infoItems
        .map(
          (item) =>
            `<div style="display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">${item.icon}</svg><span style="font-size:11px;color:#475569;">${item.label}</span></div>`,
        )
        .join("");

      const marker = L.marker([r.latitude, r.longitude], { icon } as any)
        .bindPopup(
          `<div style="font-family:'Inter',sans-serif;min-width:190px;border-radius:8px;overflow:hidden;">
              <button onclick="window.__minimizePopup()" style="position:absolute;top:6px;right:6px;z-index:10;width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;transition:all .2s ease;" onmouseover="this.style.background='rgba(0,0,0,0.7)'" onmouseout="this.style.background='rgba(0,0,0,0.45)'">
                <span style="font-size:13px;line-height:1;">&#x2715;</span>
              </button>
              ${photoHtml}
              <div style="padding:12px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                  ${infoItemsHtml}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;padding-top:8px;border-top:1px solid #F1F5F9;">
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${sevConf.color}15;color:${sevConf.color};border:1px solid ${sevConf.color}30;">
                    <span style="width:6px;height:6px;border-radius:50%;background:${sevConf.color};flex-shrink:0;"></span>
                    ${sevConf.label}
                  </span>
                  <span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:500;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;">
                    ${status}
                  </span>
                </div>
                ${(() => {
                  const showDetail =
                    userRole === "petugas"
                      ? false
                      : userRole === "warga"
                        ? currentUserId != null &&
                          r.user_id != null &&
                          String(r.user_id) === String(currentUserId)
                        : true;
                  return showDetail
                    ? `<button onclick="window.__mapViewDetail('${r.id}')" style="margin-top:4px;width:100%;padding:8px 0;background:#1A4F8A;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:background .2s;" onmouseover="this.style.background='#153d6e'" onmouseout="this.style.background='#1A4F8A'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>Lihat Detail</button>`
                    : "";
                })()}
              </div>
            </div>`,
          { maxWidth: 320, className: "" },
        )
        .bindTooltip(
          `<div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:white;">${r.road_name}</span>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sevConf.color};flex-shrink:0;"></span>
          <span style="font-size:11px;color:${sevConf.color};font-weight:500;white-space:nowrap;">${sevConf.label.replace(/^Rusak\s*/, "")}</span>
        </div>`,
          { direction: "top", offset: [0, -8] },
        );

      (marker as any).options.severity = sevKey;
      (marker as any).options.status = r.status;
      mcg.addLayer(marker);
      markers.push(marker);
    });

    markersRef.current = markers;

    // Fit bounds only on first load (when mapReports came from a fresh fetch)
    if (mapReports.length > 0 && markers.length > 0) {
      const map = mapRef.current;
      if (map && map.getZoom() === DEFAULT_ZOOM && map.getCenter().equals(DEFAULT_CENTER)) {
        if (markers.length === 1) {
          map.setView([mapReports[0].latitude!, mapReports[0].longitude!], 15);
        } else {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13, animate: false });
        }
      }
    }

    // ── Highlight report — fly to marker + open popup ──
    if (highlightReportId && mapReports.length > 0) {
      const map = mapRef.current;
      if (map && markers.length > 0) {
        const idx = mapReports.findIndex((r) => r.id === highlightReportId);
        if (idx !== -1 && markers[idx] && typeof (markers[idx] as any).getLatLng === "function") {
          const marker = markers[idx];
          const latlng = (marker as any).getLatLng();
          map.setView([latlng.lat, latlng.lng], 16, { animate: true });
          setTimeout(() => marker.openPopup?.(), 400);
        }
      }
    }

    // ── Fit to district polygon when district filter is active ──
    if (filters.district && geoJsonData && markers.length > 0) {
      if (filters.district !== lastFittedDistrictRef.current) {
        const feature = geoJsonData.features.find(
          (f: any) => f.properties?.kecamatan === filters.district,
        );
        if (feature) {
          const layer = L.geoJSON(feature);
          map.fitBounds(layer.getBounds().pad(0.15), { maxZoom: 14, animate: false });
          layer.remove();
        } else {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13, animate: false });
        }
        lastFittedDistrictRef.current = filters.district;
      }
    } else if (!filters.district && lastFittedDistrictRef.current) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      lastFittedDistrictRef.current = null;
    }
  }, [mapReports, mapReady, onViewDetail, currentUserId, highlightReportId]);

  // ── Filter callbacks ──
  const updateFilter = useCallback(
    (patch: Partial<MapFilters>) => {
      onFilterChange({ ...filters, ...patch });
    },
    [filters, onFilterChange],
  );

  function toggleStatus(s: string) {
    const next = filters.status.includes(s)
      ? filters.status.filter((x) => x !== s)
      : [...filters.status, s];
    updateFilter({ status: next });
  }

  function toggleSev(s: string) {
    const next = filters.severity.includes(s)
      ? filters.severity.filter((x) => x !== s)
      : [...filters.severity, s];
    updateFilter({ severity: next });
  }

  function resetFilters() {
    onFilterChange({
      status: [],
      severity: [],
      district: "",
      uptd_id: "",
      deadline_hari: "",
      status_deadline: "",
    });
  }

  const districts = useMemo(() => {
    if (!geoJsonData?.features) return [];
    return geoJsonData.features
      .map((f: any) => f.properties?.kecamatan)
      .filter(Boolean)
      .sort();
  }, [geoJsonData]);

  const filterPanelVisible = (isDesktop || mobileFilterOpen) && !filterMinimized;
  const activeFilterCount =
    filters.status.length +
    filters.severity.length +
    (filters.district ? 1 : 0) +
    (filters.uptd_id ? 1 : 0) +
    (filters.deadline_hari ? 1 : 0) +
    (filters.status_deadline ? 1 : 0);

  const validReportsCount = mapReports.filter((r) => r.latitude && r.longitude).length;
  const polygonsShown = zoomLevel >= POLYGON_MIN_ZOOM && zoomLevel < POLYGON_MAX_ZOOM;

  const zoomLabel = zoomLevel < POLYGON_MIN_ZOOM ? "Tampilan Kecamatan" : "Tampilan Detail";

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        aria-label="Peta interaktif laporan kerusakan jalan"
      />

      {/* Loading GeoJSON */}
      {geoJsonLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white/90 rounded-xl px-4 py-2 shadow text-[12px] text-[#64748B]">
          Memuat peta...
        </div>
      )}

      {/* Filter toggle button (always mounted) */}
      <button
        type="button"
        onClick={() => {
          if (!isDesktop) setMobileFilterOpen(true);
          else setFilterMinimized(false);
        }}
        className={`absolute top-[84px] left-2 z-[1000] w-9 h-9 bg-white rounded-lg shadow-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] transition-all duration-200 ease-out ${
          filterPanelVisible ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
        }`}
        aria-label="Buka filter"
      >
        <Icon name="filter_list" className="!text-[18px] text-[#475569]" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E11D48] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel (always mounted, animates) */}
      <div
        className={`absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-lg overflow-y-auto transition-all duration-200 ease-out ${
          filterPanelVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
        style={{ width: 200, maxHeight: "calc(100% - 24px)" }}
        aria-hidden={!filterPanelVisible}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-[#0F172A]">Filter</h3>
            <div className="flex items-center gap-1">
              {isDesktop && activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] text-[#1A4F8A] font-medium hover:underline mr-1"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFilterMinimized(true);
                  if (!isDesktop) setMobileFilterOpen(false);
                }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F1F5F9] transition-colors"
                aria-label="Minimalkan filter"
              >
                <Icon name="close" className="!text-[16px] text-[#475569]" />
              </button>
            </div>
          </div>

          {/* Severity */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Tingkat Kerusakan
            </p>
            <div className="flex flex-col gap-1">
              {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-[12px]">
                  <input
                    type="checkbox"
                    checked={filters.severity.includes(key)}
                    onChange={() => toggleSev(key)}
                    className="w-3.5 h-3.5 rounded border-[#CBD5E1] text-[#1A4F8A] focus:ring-[#1A4F8A]"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cfg.color }}
                  />
                  <span className="text-[#0F172A]">{cfg.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Status
            </p>
            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
              {ALL_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer text-[12px]">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(s)}
                    onChange={() => toggleStatus(s)}
                    className="w-3.5 h-3.5 rounded border-[#CBD5E1] text-[#1A4F8A] focus:ring-[#1A4F8A]"
                  />
                  <span className="text-[#0F172A]">{displayStatus(s)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Kecamatan */}
          {districts.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                Kecamatan
              </p>
              <select
                value={filters.district}
                onChange={(e) => updateFilter({ district: e.target.value })}
                className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1A4F8A]"
              >
                <option value="">Semua Kecamatan</option>
                {districts.map((d: string) => {
                  const ds = districtStats[d];
                  return (
                    <option key={d} value={d}>
                      {d}
                      {ds ? ` (${ds.total})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* UPTD */}
          {teamList.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                UPTD / Tim Satgas
              </p>
              <select
                value={filters.uptd_id}
                onChange={(e) => updateFilter({ uptd_id: e.target.value })}
                className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1A4F8A]"
              >
                <option value="">Semua UPTD</option>
                {teamList.map((u) => {
                  const optValue = u.uptd?.id ?? u.id;
                  const optLabel = u.uptd?.nama ?? u.name;
                  return (
                    <option key={optValue} value={String(optValue)}>
                      {optLabel}
                      {u.wilayah ? ` (${u.wilayah})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Deadline Status */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Deadline
            </p>
            <select
              value={filters.status_deadline}
              onChange={(e) => updateFilter({ status_deadline: e.target.value, deadline_hari: "" })}
              className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1A4F8A]"
            >
              <option value="">Semua</option>
              <option value="terlambat">Terlewat Deadline</option>
              <option value="tepat_waktu">Tepat Waktu</option>
            </select>
          </div>

          {!isDesktop && activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 w-full py-1.5 text-[12px] text-[#1A4F8A] font-medium border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC]"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Floating reopen stats button (always mounted) */}
      <button
        type="button"
        onClick={() => setShowStats(true)}
        className={`absolute top-3 right-2 z-[1000] w-9 h-9 bg-white rounded-lg shadow-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] transition-all duration-200 ease-out ${
          showStats ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
        }`}
        aria-label="Buka ringkasan"
      >
        <Icon name="bar_chart" className="!text-[18px] text-[#475569]" />
      </button>

      {/* Stats Panel (always mounted, animates) */}
      <div
        className={`absolute top-3 right-3 z-[1000] transition-all duration-200 ease-out ${
          showStats ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
        style={{ width: 176, maxHeight: "calc(100% - 24px)" }}
        aria-hidden={!showStats}
      >
        <div className="bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-lg">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-bold text-[#0F172A]">Ringkasan</h3>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F1F5F9] transition-colors"
                aria-label="Minimalkan"
              >
                <Icon name="close" className="!text-[14px] text-[#64748B]" />
              </button>
            </div>

            <p className="text-[24px] font-bold text-[#0F172A] leading-none mb-3">
              {mapStats.total}
            </p>

            {/* By Severity */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                Tingkat Kerusakan
              </p>
              <div className="flex flex-col gap-1">
                {(["berat", "sedang", "ringan"] as const).map((key) => {
                  const cfg = SEVERITY_CONFIG[key];
                  const count = mapStats.by_severity[key] ?? 0;
                  const pct = mapStats.total > 0 ? (count / mapStats.total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: cfg.color }}
                      />
                      <span className="text-[11px] text-[#475569] flex-1">{cfg.label}</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{count}</span>
                      <div className="w-12 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: cfg.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Status */}
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                Status
              </p>
              <div className="flex flex-col gap-0.5">
                {(
                  [
                    "Menunggu Review",
                    "Disetujui",
                    "Sedang Diperbaiki",
                    "Selesai",
                    "Ditolak",
                  ] as const
                ).map((key) => {
                  const count = (mapStats.by_status as any)[key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[11px] text-[#475569]">{key}</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(mapStats.terlambat_count > 0 ||
              (mapStats.terlambat_review ?? 0) > 0 ||
              (mapStats.terlambat_resolusi ?? 0) > 0) && (
              <div className="mt-2 pt-2 border-t border-[#F1F5F9] space-y-1">
                {mapStats.terlambat_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Icon name="warning" className="!text-[14px] text-[#E11D48]" />
                    <span className="text-[11px] text-[#E11D48] font-medium">
                      {mapStats.terlambat_count} laporan &gt; 7 hari
                    </span>
                  </div>
                )}
                {(mapStats.terlambat_review ?? 0) > 0 && (
                  <div className="flex items-center gap-1 ml-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-[10px] text-[#E11D48]">
                      Review: {mapStats.terlambat_review} terlewat
                    </span>
                  </div>
                )}
                {(mapStats.terlambat_resolusi ?? 0) > 0 && (
                  <div className="flex items-center gap-1 ml-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-[10px] text-[#E11D48]">
                      Perbaikan: {mapStats.terlambat_resolusi} terlewat
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layer indicator + Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 max-h-64 w-50">
        {/* Zoom Layer Indicator */}
        <div className="bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
              Layer
            </span>
            <span className="text-[10px] text-[#0F172A] font-medium">{zoomLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {[8, 9, 10, 11, 12, 13, 14].map((z) => (
              <div
                key={z}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: zoomLevel === z ? 12 : 6,
                  background: z < POLYGON_MIN_ZOOM ? "#94A3B8" : "#1A4F8A",
                  opacity: zoomLevel === z ? 1 : 0.4,
                }}
              />
            ))}
          </div>
        </div>

        {/* Legend (always mounted, animates) */}
        <div
          className={`transition-all duration-200 ease-out ${
            showLegend
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1 pointer-events-none absolute"
          }`}
          aria-hidden={!showLegend}
        >
          <div className="bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-2 py-1.5 flex flex-col gap-0.5 shadow-sm">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
                Tingkat Kerusakan
              </p>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#F1F5F9] transition-colors"
                aria-label="Minimalkan legend"
              >
                <Icon name="close" className="!text-[12px] text-[#64748B]" />
              </button>
            </div>
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.color }} />
                <span className="text-[10px] text-[#475569] whitespace-nowrap">{cfg.label}</span>
              </div>
            ))}
            <div className="border-t border-[#E2E8F0] my-1" />
            <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">
              Status
            </p>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: "#16A34A",
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Selesai</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: "#DC2626",
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Ditolak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: "#2563EB",
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">
                Disetujui / Diperbaiki
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: "#64748B",
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Menunggu Review</span>
            </div>
          </div>
        </div>
        {/* Legend toggle (always mounted) */}
        <button
          type="button"
          onClick={() => setShowLegend(true)}
          className={`self-end transition-all duration-200 ease-out ${
            showLegend
              ? "opacity-0 scale-75 pointer-events-none w-0 h-0 overflow-hidden"
              : "opacity-100 scale-100 w-8 h-8 bg-white mb-3"
          } flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors shadow-md`}
          aria-label="Buka legend"
        >
          <Icon name="legend_toggle" className="!text-[20px] text-[#64748B]" />
        </button>
      </div>

      {/* Bottom indicator */}
      {validReportsCount > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 shadow-sm">
          <span className="text-[11px] text-[#475569]">
            Menampilkan <strong>{validReportsCount}</strong> laporan
          </span>
        </div>
      )}
    </div>
  );
}
