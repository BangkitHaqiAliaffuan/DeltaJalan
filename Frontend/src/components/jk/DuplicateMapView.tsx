/**
 * DuplicateMapView
 *
 * Komponen peta Leaflet untuk menampilkan posisi petugas (marker biru)
 * dan laporan duplikat terdekat (marker merah).
 *
 * PENTING: Komponen ini harus di-render hanya di sisi klien (client-side only)
 * karena Leaflet bergantung pada objek `window` browser.
 * Gunakan dynamic import dengan { ssr: false } atau lazy loading.
 *
 * Requirement 5: Tampilan Peta Interaktif (MapView)
 */

import { useEffect, useRef } from "react";
import type { DuplicateReport } from "@/hooks/useDuplicateCheck";

// ── Leaflet CSS ────────────────────────────────────────────────────────────
// Import CSS Leaflet secara langsung agar tile dan marker tampil dengan benar
import "leaflet/dist/leaflet.css";

// ── Konstanta ──────────────────────────────────────────────────────────────

/** Koordinat default Kabupaten Sidoarjo */
const DEFAULT_CENTER: [number, number] = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 13;
const GPS_ZOOM = 18;

// ── Props ──────────────────────────────────────────────────────────────────

interface DuplicateMapViewProps {
  /** Koordinat GPS petugas (null jika belum tersedia) */
  userLat: number | null;
  userLng: number | null;
  /** Laporan duplikat spasial untuk ditampilkan sebagai marker merah */
  spatialDuplicates: DuplicateReport[];
  /** Apakah GPS sedang dalam proses deteksi */
  isLoading?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DuplicateMapView({
  userLat,
  userLng,
  spatialDuplicates,
  isLoading = false,
}: DuplicateMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // Simpan instance peta agar bisa di-update tanpa re-render
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const duplicateMarkersRef = useRef<import("leaflet").Marker[]>([]);

  // ── Inisialisasi Peta ──────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Sudah diinisialisasi

    // Import Leaflet secara dinamis untuk menghindari SSR error
    import("leaflet").then((L) => {
      if (!mapContainerRef.current || mapRef.current) return;

      // Fix icon path Leaflet yang sering bermasalah dengan bundler
      // Leaflet mencari icon di path relatif yang tidak sesuai dengan Vite
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const center: [number, number] =
        userLat !== null && userLng !== null
          ? [userLat, userLng]
          : DEFAULT_CENTER;

      const zoom = userLat !== null ? GPS_ZOOM : DEFAULT_ZOOM;

      const map = L.map(mapContainerRef.current!, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      // Tile layer OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Render marker awal jika koordinat sudah tersedia
      if (userLat !== null && userLng !== null) {
        addUserMarker(L, map, userLat, userLng);
      }

      if (spatialDuplicates.length > 0) {
        addDuplicateMarkers(L, map, spatialDuplicates);
      }
    });

    return () => {
      // Cleanup saat komponen unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update Marker Petugas ──────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      // Hapus marker lama
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      if (userLat !== null && userLng !== null) {
        addUserMarker(L, map, userLat, userLng);

        // Sesuaikan view peta
        if (spatialDuplicates.length > 0) {
          // Fit bounds agar semua marker terlihat
          const bounds = L.latLngBounds([[userLat, userLng]]);
          spatialDuplicates.forEach((d) => {
            if (d.latitude !== null && d.longitude !== null) {
              bounds.extend([d.latitude, d.longitude]);
            }
          });
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: GPS_ZOOM });
        } else {
          map.setView([userLat, userLng], GPS_ZOOM);
        }
      }
    });
  }, [userLat, userLng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update Marker Duplikat ─────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      // Hapus marker duplikat lama
      duplicateMarkersRef.current.forEach((m) => m.remove());
      duplicateMarkersRef.current = [];

      if (spatialDuplicates.length > 0) {
        addDuplicateMarkers(L, map, spatialDuplicates);
      }
    });
  }, [spatialDuplicates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: Tambah Marker Petugas (Biru) ──────────────────────────────

  function addUserMarker(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    lat: number,
    lng: number
  ) {
    // Marker biru custom menggunakan SVG inline
    const blueIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width: 28px; height: 28px;
          background: #1A4F8A;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(26,79,138,0.5);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 8px; height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([lat, lng], { icon: blueIcon })
      .addTo(map)
      .bindTooltip("Posisi Anda", {
        permanent: false,
        direction: "top",
        offset: [0, -16],
      });

    userMarkerRef.current = marker;
  }

  // ── Helper: Tambah Marker Duplikat (Merah) ────────────────────────────

  function addDuplicateMarkers(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    duplicates: DuplicateReport[]
  ) {
    const redIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width: 28px; height: 36px;
          position: relative;
        ">
          <div style="
            width: 28px; height: 28px;
            background: #EF4444;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(239,68,68,0.5);
          "></div>
        </div>
      `,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });

    duplicates.forEach((report) => {
      if (report.latitude === null || report.longitude === null) return;

      const distanceText =
        report.distance_meters !== undefined
          ? ` (${report.distance_meters}m)`
          : "";

      const marker = L.marker([report.latitude, report.longitude], { icon: redIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: 'Inter', sans-serif; min-width: 180px;">
            <p style="font-weight: 600; color: #0F172A; margin: 0 0 4px;">
              ${report.report_code}
            </p>
            <p style="color: #475569; font-size: 12px; margin: 0 0 2px;">
              ${report.road_name}
            </p>
            <p style="color: #64748B; font-size: 11px; margin: 0;">
              ${report.district}${distanceText}
            </p>
            <span style="
              display: inline-block; margin-top: 6px;
              background: #FEF3C7; color: #92400E;
              border: 1px solid #FCD34D;
              border-radius: 9999px; padding: 1px 8px;
              font-size: 11px; font-weight: 500;
            ">${report.status}</span>
          </div>`,
          { maxWidth: 240 }
        );

      duplicateMarkersRef.current.push(marker);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#E2E8F0]" style={{ minHeight: 200 }}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[1000] bg-white/70 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-[#1E40AF]">
            <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            <span className="text-[13px] font-medium">Memuat peta...</span>
          </div>
        </div>
      )}

      {/* Kontainer peta Leaflet */}
      <div
        ref={mapContainerRef}
        style={{ height: 220, width: "100%" }}
        aria-label="Peta lokasi laporan kerusakan jalan"
      />

      {/* Legend */}
      <div className="absolute bottom-2 right-2 z-[999] bg-white/90 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#1A4F8A] border-2 border-white shadow-sm" />
          <span className="text-[10px] text-[#475569]">Posisi Anda</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#EF4444] border-2 border-white shadow-sm" />
          <span className="text-[10px] text-[#475569]">Laporan aktif</span>
        </div>
      </div>
    </div>
  );
}
