import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import type { LaporanMarker, DistrictSummary, MapStats } from "@/types/laporan";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const DEFAULT_CENTER: [number, number] = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 11;
const POLYGON_MIN_ZOOM = 10;
const UNCLUSTER_ZOOM = 13;

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

const ALL_STATUSES = [
  "Menunggu Review",
  "Ditinjau",
  "Disetujui",
  "Ditolak",
  "Sedang Diperbaiki",
  "Selesai",
  "Diedit",
];

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  "Menunggu Review":  { color: "#64748B", label: "Menunggu" },
  Ditinjau:           { color: "#64748B", label: "Ditinjau" },
  Disetujui:          { color: "#2563EB", label: "Disetujui" },
  "Sedang Diperbaiki":{ color: "#D97706", label: "Diperbaiki" },
  Selesai:            { color: "#16A34A", label: "Selesai" },
  Ditolak:            { color: "#DC2626", label: "Ditolak" },
  Diedit:             { color: "#6B7280", label: "Diedit" },
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
  upr_id: string;
  deadline_hari: string;
  status_deadline: string;
}

interface PetaInteraktifProps {
  mapReports: LaporanMarker[];
  districtStats: Record<string, DistrictSummary>;
  mapStats: MapStats;
  uprList: { id: number; name: string; wilayah?: string }[];
  filters: MapFilters;
  onFilterChange: (filters: MapFilters) => void;
  onViewDetail?: (id: string) => void;
  userRole?: string;
}

export function PetaInteraktif({
  mapReports,
  districtStats,
  mapStats,
  uprList,
  filters,
  onFilterChange,
  onViewDetail,
  userRole,
}: PetaInteraktifProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const markerClusterRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const currentZoomRef = useRef(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoJsonLoading, setGeoJsonLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  const [isDesktop, setIsDesktop] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filterMinimized, setFilterMinimized] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // ── Dynamic Leaflet import (single chunk — leaflet + markercluster in one module) ──
  useEffect(() => {
    let cancelled = false;
    import("@/lib/leaflet-bundle").then((mod) => {
      if (cancelled) return;
      LRef.current = mod.default;
      setLeafletReady(true);
    });
    return () => { cancelled = true; };
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
        avg_severity_score:
          s && s.total > 0 ? parseFloat((s.score / s.total).toFixed(2)) : 0,
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
      .leaflet-popup-content-wrapper { border-radius: 12px !important; overflow: hidden; }
      .leaflet-popup-content { margin: 0 !important; }
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
      const show = z >= POLYGON_MIN_ZOOM && z < UNCLUSTER_ZOOM;
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
      const markersVisible = z < POLYGON_MIN_ZOOM || z >= UNCLUSTER_ZOOM;
      if (markerClusterRef.current) {
        if (markersVisible && !map.hasLayer(markerClusterRef.current)) {
          map.addLayer(markerClusterRef.current);
        } else if (!markersVisible && map.hasLayer(markerClusterRef.current)) {
          map.removeLayer(markerClusterRef.current);
        }
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
        if (pane) { pane.style.transition = "none"; }
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
            <p style="font-weight:600;font-size:14px;color:#0F172A;margin:0 0 4px;">Kec. ${kec}</p>
            <div style="font-size:12px;color:#475569;">
              ${ds ? `
                <p style="margin:2px 0;">Total laporan: <strong>${ds.total}</strong></p>
                <p style="margin:2px 0;">🔴 Rusak Berat: ${ds.rusak_berat}</p>
                <p style="margin:2px 0;">🟠 Rusak Sedang: ${ds.rusak_sedang}</p>
                <p style="margin:2px 0;">🟡 Rusak Ringan: ${ds.rusak_ringan}</p>
                <p style="margin:4px 0 0;padding-top:4px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">Laporan aktif: <strong>${activeTotal}</strong> (belum selesai)</p>
              ` : `<p style="margin:2px 0;">Tidak ada data laporan</p>`}
            </div>
          </div>`,
          { maxWidth: 260 },
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

    // Create cluster group once
    if (!markerClusterRef.current) {
        const mcg = L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          disableClusteringAtZoom: UNCLUSTER_ZOOM,
          iconCreateFunction: (cluster: any) => {
            const subMarkers = cluster.getAllChildMarkers();
            let berat = 0;
            let selesai = 0;
            subMarkers.forEach((m: any) => {
              const sev = m.options?.severity ?? "baik";
              if (sev === "berat") berat++;
              const st = m.options?.status ?? "";
              if (st === "Selesai") selesai++;
            });
            const color = berat > 0 ? "#E11D48" : "#1A4F8A";
            const count = cluster.getChildCount();
            const badgeHtml = selesai > 0
              ? `<div style="position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#16A34A;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4);"><span style="color:white;font-size:8px;font-weight:700;">${selesai}</span></div>`
              : "";
            return L.divIcon({
              html: `<div style="width:40px;height:40px;position:relative;">
                <div style="width:40px;height:40px;background:${color};color:white;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${count}</div>
                ${badgeHtml}
              </div>`,
              className: "",
              iconSize: L.point(40, 40),
            });
          },
        });
        const initialZ = currentZoomRef.current;
        const markersInitiallyVisible = initialZ < POLYGON_MIN_ZOOM || initialZ >= UNCLUSTER_ZOOM;
        if (markersInitiallyVisible) {
          map.addLayer(mcg);
        }
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
          ? `<img src="${r.first_photo_url}" loading="lazy" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0;" alt="" />`
          : `<div style="width:100%;height:100px;background:#F1F5F9;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;color:#CBD5E1;font-size:24px;">📷</div>`;

        const dimensiHtml =
          r.kerusakan_panjang != null && r.kerusakan_lebar != null
            ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748B;margin-top:4px;"><span>📐</span><span>${r.kerusakan_panjang}m &times; ${r.kerusakan_lebar}m</span></div>`
            : "";

        const uprHtml = r.assigned_upr_name
          ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748B;margin-top:2px;"><span>👥</span><span>${r.assigned_upr_name}</span></div>`
          : "";

        const marker = L.marker([r.latitude, r.longitude], { icon } as any)
          .bindPopup(
            `<div style="font-family:'Inter',sans-serif;min-width:220px;border-radius:8px;overflow:hidden;">
              <button onclick="window.__minimizePopup()" style="position:absolute;top:8px;right:8px;z-index:10;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);color:white;border:none;border-radius:8px;cursor:pointer;font-size:18px;transition:all .2s ease;" onmouseover="this.style.background='rgba(0,0,0,0.7)'" onmouseout="this.style.background='rgba(0,0,0,0.45)'">
                <span style="font-size:18px;line-height:1;">&#x2715;</span>
              </button>
              ${photoHtml}
              <div style="padding:10px;">
                <p style="font-size:11px;color:#475569;margin:0 0 2px;">${r.road_name}</p>
                <p style="font-weight:600;font-size:14px;color:#0F172A;margin:0 0 2px;">${r.road_name}</p>
                <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748B;margin-bottom:6px;flex-wrap:wrap;">
                  <span>📍 ${r.district ?? "-"}</span>
                  <span>·</span>
                  <span>⭐ ${r.trust_score ?? "—"}</span>
                  <span>·</span>
                  <span>🕐 ${formatAge(r.created_at)}</span>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
                  <span style="display:inline-block;background:${sevConf.color}15;color:${sevConf.color};border:1px solid ${sevConf.color}30;border-radius:9999px;padding:0 8px;font-size:10px;font-weight:600;">${sevConf.label}</span>
                  <span style="display:inline-block;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;border-radius:9999px;padding:0 8px;font-size:10px;font-weight:500;">${status}</span>
                </div>
                ${dimensiHtml}
                ${uprHtml}
                ${userRole === 'petugas' ? '' : `<button onclick="window.__mapViewDetail('${r.id}')" style="margin-top:8px;width:100%;padding:6px 0;background:#1A4F8A;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">🔍 Lihat Detail</button>`}
              </div>
            </div>`,
            { maxWidth: 280, className: "" },
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
            map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13 });
          }
        }
      }
  }, [mapReports, mapReady, onViewDetail]);

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
    onFilterChange({ status: [], severity: [], district: "", upr_id: "", deadline_hari: "", status_deadline: "" });
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
    filters.status.length + filters.severity.length + (filters.district ? 1 : 0) + (filters.upr_id ? 1 : 0) + (filters.deadline_hari ? 1 : 0) + (filters.status_deadline ? 1 : 0);

  const validReportsCount = mapReports.filter((r) => r.latitude && r.longitude).length;
  const polygonsShown = zoomLevel >= POLYGON_MIN_ZOOM && zoomLevel < UNCLUSTER_ZOOM;
  const isUnclustered = zoomLevel >= UNCLUSTER_ZOOM;

  const zoomLabel =
    zoomLevel < POLYGON_MIN_ZOOM
      ? "Tampilan Kecamatan"
      : zoomLevel >= UNCLUSTER_ZOOM
        ? "Tampilan Detail"
        : "Tampilan Cluster";

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" aria-label="Peta interaktif laporan kerusakan jalan" />

      {/* Loading GeoJSON */}
      {geoJsonLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white/90 rounded-xl px-4 py-2 shadow text-[12px] text-[#64748B]">
          Memuat peta...
        </div>
      )}

      {/* Filter toggle button (always mounted) */}
      <button
        type="button"
        onClick={() => { if (!isDesktop) setMobileFilterOpen(true); else setFilterMinimized(false); }}
        className={`absolute top-[88px] left-3 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] transition-all duration-200 ease-out ${
          filterPanelVisible ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
        }`}
        aria-label="Buka filter"
      >
        <Icon name="filter_list" className="!text-[20px] text-[#475569]" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E11D48] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel (always mounted, animates) */}
      <div
        className={`absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-lg overflow-y-auto transition-all duration-200 ease-out ${
          filterPanelVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ width: 220, maxHeight: "calc(100% - 24px)" }}
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
                onClick={() => { setFilterMinimized(true); if (!isDesktop) setMobileFilterOpen(false); }}
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
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                    <span className="text-[#0F172A]">{cfg.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Status</p>
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
                <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Kecamatan</p>
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
                        {d}{ds ? ` (${ds.total})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* UPR */}
            {uprList.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">UPR / Tim Satgas</p>
                <select
                  value={filters.upr_id}
                  onChange={(e) => updateFilter({ upr_id: e.target.value })}
                  className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1A4F8A]"
                >
                  <option value="">Semua UPR</option>
                  {uprList.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}{u.wilayah ? ` (${u.wilayah})` : ""}
                    </option>
                  ))}
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
        className={`absolute top-3 right-3 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] transition-all duration-200 ease-out ${
          showStats ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
        }`}
        aria-label="Buka ringkasan"
      >
        <Icon name="bar_chart" className="!text-[20px] text-[#475569]" />
      </button>

      {/* Stats Panel (always mounted, animates) */}
      <div
        className={`absolute top-3 right-3 z-[1000] transition-all duration-200 ease-out ${
          showStats
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ width: 200, maxHeight: "calc(100% - 24px)" }}
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

            <p className="text-[24px] font-bold text-[#0F172A] leading-none mb-3">{mapStats.total}</p>

            {/* By Severity */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Tingkat Kerusakan</p>
              <div className="flex flex-col gap-1">
                {(["berat", "sedang", "ringan"] as const).map((key) => {
                  const cfg = SEVERITY_CONFIG[key];
                  const count = mapStats.by_severity[key] ?? 0;
                  const pct = mapStats.total > 0 ? (count / mapStats.total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
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
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Status</p>
              <div className="flex flex-col gap-0.5">
                {(["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai", "Ditolak"] as const).map((key) => {
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

            {(mapStats.terlambat_count > 0 || (mapStats.terlambat_review ?? 0) > 0 || (mapStats.terlambat_resolusi ?? 0) > 0) && (
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
            <span className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">Layer</span>
            <span className="text-[10px] text-[#0F172A] font-medium">{zoomLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            {[8, 9, 10, 11, 12, 13, 14].map((z) => (
              <div
                key={z}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: zoomLevel === z ? 12 : 6,
                  background:
                    z < POLYGON_MIN_ZOOM ? "#94A3B8" :
                    z >= UNCLUSTER_ZOOM ? "#1A4F8A" :
                    "#3B82F6",
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
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 pointer-events-none absolute'
          }`}
          aria-hidden={!showLegend}
        >
          <div className="bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">Tingkat Kerusakan</p>
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
            <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Status</p>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "#16A34A", border: "2px solid white", boxShadow: "0 0 0 1px #E2E8F0" }} />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Selesai</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "#DC2626", border: "2px solid white", boxShadow: "0 0 0 1px #E2E8F0" }} />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Ditolak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "#2563EB", border: "2px solid white", boxShadow: "0 0 0 1px #E2E8F0" }} />
              <span className="text-[10px] text-[#475569] whitespace-nowrap">Disetujui / Diperbaiki</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "#64748B", border: "2px solid white", boxShadow: "0 0 0 1px #E2E8F0" }} />
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
              ? 'opacity-0 scale-75 pointer-events-none w-0 h-0 overflow-hidden'
              : 'opacity-100 scale-100 w-10 h-10 bg-white mb-5'
          } flex items-center justify-center rounded hover:bg-[#F1F5F9] transition-colors`}
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
