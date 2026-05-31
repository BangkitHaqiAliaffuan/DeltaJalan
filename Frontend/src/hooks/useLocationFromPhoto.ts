/**
 * useLocationFromPhoto
 *
 * Hook untuk mendapatkan koordinat GPS dari EXIF foto:
 *
 * 1. KAMERA  → exifr.gps(file) — EXIF foto (bukan browser geolocation)
 * 2. GALERI  → exifr.gps(file) — EXIF foto
 * 3. REVERSE GEOCODING — chain 3 service:
 *    a. LocationIQ (5 field: road/path/pedestrian/cycleway/footway) + kecamatan
 *    b. OSRM Nearest (snapped road name dari routing graph)
 *    c. Overpass API (raw OSM query — nearest named highway dalam 100m)
 * 4. FALLBACK → user isi manual lewat autocomplete
 */

import { useState, useCallback } from "react";
import exifr from "exifr";
import { snapToRoad } from "@/lib/geo";

// ── Konstanta ──────────────────────────────────────────────────────────────

/** API key LocationIQ dari environment variable Vite */
export const LOCATIONIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY as string;

/** Endpoint reverse geocoding LocationIQ */
const LOCATIONIQ_REVERSE_URL = "https://us1.locationiq.com/v1/reverse";

/** 18 kecamatan Sidoarjo beserta alias yang mungkin muncul dari LocationIQ */
const KECAMATAN_MAP: Record<string, string> = {
  sidoarjo: "Sidoarjo",
  buduran: "Buduran",
  gedangan: "Gedangan",
  sedati: "Sedati",
  waru: "Waru",
  taman: "Taman",
  krian: "Krian",
  balongbendo: "Balongbendo",
  wonoayu: "Wonoayu",
  sukodono: "Sukodono",
  candi: "Candi",
  tarik: "Tarik",
  prambon: "Prambon",
  porong: "Porong",
  krembung: "Krembung",
  tulangan: "Tulangan",
  tanggulangin: "Tanggulangin",
  jabon: "Jabon",
};

// ── Types ──────────────────────────────────────────────────────────────────

export type LocationSource = "exif" | "manual" | null;

export type GpsStatus =
  | "idle"
  | "detecting" // sedang mengambil koordinat
  | "geocoding" // sedang reverse geocoding
  | "success" // berhasil auto-fill dengan nama jalan
  | "success_no_road" // koordinat didapat tapi nama jalan kosong (user isi manual)
  | "exif_no_gps" // foto galeri tidak punya GPS EXIF
  | "permission_denied"
  | "timeout"
  | "error";

export interface LocationState {
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  status: GpsStatus;
  statusMessage: string;
  /** true = nama jalan dari reverse geocoding valid, field harus readOnly */
  roadNameLocked: boolean;
}

export interface UseLocationFromPhotoReturn {
  locationState: LocationState;
  /** Panggil ini saat user memilih foto dari KAMERA (capture="environment") */
  handleCameraCapture: (file: File) => Promise<void>;
  /** Panggil ini saat user memilih foto dari GALERI */
  handleGallerySelect: (file: File) => Promise<void>;
  /** Reset state lokasi */
  resetLocation: () => void;
}

// ── Helper: LocationIQ Address ─────────────────────────────────────────────

interface LocationIQAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  town?: string;
  village?: string;
  county?: string;
  city?: string;
  state?: string;
  country?: string;
  [key: string]: string | undefined;
}

interface LocationIQResponse {
  address: LocationIQAddress;
  display_name: string;
  lat: string;
  lon: string;
}

export interface ReverseGeocodeResult {
  /** Nama jalan dari address.road — kosong string jika tidak ada */
  namaJalan: string;
  /** true jika address.road valid dan spesifik */
  roadFound: boolean;
  /** Kecamatan yang cocok dengan 18 kecamatan Sidoarjo */
  kecamatan: string | null;
}

/** Cocokkan string dari LocationIQ ke salah satu dari 18 kecamatan Sidoarjo */
function matchKecamatan(raw: string): string | null {
  if (!raw) return null;
  const normalized = raw
    .toLowerCase()
    .replace(/kecamatan\s*/i, "")
    .trim();
  if (KECAMATAN_MAP[normalized]) return KECAMATAN_MAP[normalized];
  for (const [key, value] of Object.entries(KECAMATAN_MAP)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

/**
 * Reverse geocoding — mencoba LocationIQ dulu, fallback ke OSRM Nearest
 * kalau LocationIQ tidak menemukan nama jalan.
 *
 * Logika nama jalan:
 * - LocationIQ address.road → OSRM waypoints[0].name (fallback)
 * - Jika keduanya kosong → roadFound=false, namaJalan="" (user isi manual)
 */
/** Cari nama jalan dari berbagai field address LocationIQ */
function extractRoadFromLocationIQ(addr: Record<string, unknown>): string {
  const candidates = [addr.road, addr.path, addr.pedestrian, addr.cycleway, addr.footway];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/**
 * Reverse geocoding — mencoba LocationIQ dulu, fallback ke OSRM Nearest,
 * lalu Photon (komoot).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // ── Primary: LocationIQ ────────────────────────────────────────────────
  const url = new URL(LOCATIONIQ_REVERSE_URL);
  url.searchParams.set("key", LOCATIONIQ_KEY);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "id");

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`LocationIQ reverse geocoding error: ${res.status}`);
  }

  const data: LocationIQResponse = await res.json();
  const addr = data.address ?? {};
  console.log("REVERSE_GEO: LocationIQ address =", addr);

  // ── Nama Jalan dari LocationIQ ──────────────────────────────────────────
  const road = extractRoadFromLocationIQ(addr);
  let namaJalan = "";
  let roadFound = false;

  if (road) {
    roadFound = true;
    const parts = [road];
    if (addr.house_number) parts.push(`No. ${addr.house_number}`);
    namaJalan = parts.join(" ");
  }
  console.log(
    "REVERSE_GEO: road dari LocationIQ =",
    JSON.stringify(road),
    "→ namaJalan =",
    namaJalan,
  );

  // ── Kecamatan ───────────────────────────────────────────────────────────
  const kecamatanRaw =
    addr.city_district ??
    addr.suburb ??
    addr.town ??
    addr.village ??
    addr.city ??
    addr.county ??
    "";
  const kecamatan = matchKecamatan(kecamatanRaw);
  console.log("REVERSE_GEO: kecamatanRaw =", kecamatanRaw, "→ kecamatan =", kecamatan);

  // ── Fallback 1: OSRM Nearest ────────────────────────────────────────────
  if (!namaJalan) {
    console.log("REVERSE_GEO: LocationIQ kosong — coba OSRM fallback");
    try {
      const osmResult = await snapToRoad(lat, lng);
      console.log("REVERSE_GEO: OSRM result =", osmResult);
      if (osmResult.roadName) {
        namaJalan = osmResult.roadName;
        roadFound = true;
        console.log("REVERSE_GEO: pakai nama jalan dari OSRM:", namaJalan);
      }
    } catch (e) {
      console.warn("REVERSE_GEO: OSRM fallback error", e);
    }
  }

  // ── Fallback 2: Overpass API (query OSM raw data) ──────────────────────
  if (!namaJalan) {
    console.log("REVERSE_GEO: OSRM juga kosong — coba Overpass API");
    try {
      const overpassQuery = `[out:json];way(around:100,${lat},${lng})[highway][name];out 1;`;
      const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });
      if (overpassRes.ok) {
        const overpassData = await overpassRes.json();
        console.log("REVERSE_GEO: Overpass elements =", overpassData.elements);
        const roadName = overpassData.elements?.[0]?.tags?.name;
        if (roadName) {
          namaJalan = roadName;
          roadFound = true;
          console.log("REVERSE_GEO: pakai nama jalan dari Overpass:", namaJalan);
        } else {
          console.log("REVERSE_GEO: Overpass juga gak punya nama jalan");
        }
      }
    } catch (e) {
      console.warn("REVERSE_GEO: Overpass fallback error", e);
    }
  }

  console.log("REVERSE_GEO: final result =", { namaJalan, roadFound, kecamatan });
  return { namaJalan, roadFound, kecamatan };
}

// ── Helper: EXIF GPS dari file ────────────────────────────────────────────

export interface ExifGps {
  latitude: number;
  longitude: number;
}

export async function readExifGps(file: File): Promise<ExifGps | null> {
  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number" &&
      !isNaN(gps.latitude) &&
      !isNaN(gps.longitude)
    ) {
      return { latitude: gps.latitude, longitude: gps.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: LocationState = {
  lat: null,
  lng: null,
  source: null,
  status: "idle",
  statusMessage: "",
  roadNameLocked: false,
};

export function useLocationFromPhoto(
  onLocationResolved: (
    namaJalan: string,
    kecamatan: string | null,
    lat: number,
    lng: number,
    roadNameLocked: boolean,
  ) => void,
  onLocationFailed: (reason: GpsStatus) => void,
): UseLocationFromPhotoReturn {
  const [locationState, setLocationState] = useState<LocationState>(INITIAL_STATE);

  /** Proses koordinat yang sudah didapat: lakukan reverse geocoding lalu callback */
  const processCoordinates = useCallback(
    async (lat: number, lng: number, source: LocationSource) => {
      setLocationState((s) => ({
        ...s,
        lat,
        lng,
        source,
        status: "geocoding",
        statusMessage: "Mengidentifikasi lokasi...",
        roadNameLocked: false,
      }));

      try {
        const { namaJalan, roadFound, kecamatan } = await reverseGeocode(lat, lng);

        const status: GpsStatus = "success";
        const statusMessage = roadFound
          ? "Lokasi terdeteksi via EXIF foto"
          : "Koordinat didapat, nama jalan tidak ditemukan — isi manual";

        setLocationState({
          lat,
          lng,
          source,
          status,
          statusMessage,
          roadNameLocked: roadFound,
        });

        onLocationResolved(namaJalan, kecamatan, lat, lng, roadFound);
      } catch {
        // Reverse geocoding gagal — koordinat tetap tersimpan, nama jalan kosong
        setLocationState({
          lat,
          lng,
          source,
          status: "success",
          statusMessage: "Koordinat didapat, gagal identifikasi nama jalan",
          roadNameLocked: false,
        });
        onLocationResolved("", null, lat, lng, false);
      }
    },
    [onLocationResolved],
  );

  /** STRATEGI 1: Foto dari kamera → baca EXIF GPS dari hasil jepretan */
  const handleCameraCapture = useCallback(
    async (file: File) => {
      setLocationState({
        lat: null,
        lng: null,
        source: "exif",
        status: "detecting",
        statusMessage: "Membaca metadata GPS dari foto...",
        roadNameLocked: false,
      });

      const gps = await readExifGps(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
      } else {
        setLocationState({
          lat: null,
          lng: null,
          source: "exif",
          status: "exif_no_gps",
          statusMessage: "Foto tidak memiliki data GPS. Cari nama jalan via autocomplete.",
          roadNameLocked: false,
        });
        onLocationFailed("exif_no_gps");
      }
    },
    [processCoordinates, onLocationFailed],
  );

  /** STRATEGI 2: Foto dari galeri → baca EXIF GPS */
  const handleGallerySelect = useCallback(
    async (file: File) => {
      setLocationState({
        lat: null,
        lng: null,
        source: "exif",
        status: "detecting",
        statusMessage: "Membaca metadata GPS dari foto...",
        roadNameLocked: false,
      });

      const gps = await readExifGps(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
      } else {
        setLocationState({
          lat: null,
          lng: null,
          source: "exif",
          status: "exif_no_gps",
          statusMessage: "Foto tidak memiliki data GPS. Cari nama jalan via autocomplete.",
          roadNameLocked: false,
        });
        onLocationFailed("exif_no_gps");
      }
    },
    [processCoordinates, onLocationFailed],
  );

  const resetLocation = useCallback(() => {
    setLocationState(INITIAL_STATE);
  }, []);

  return { locationState, handleCameraCapture, handleGallerySelect, resetLocation };
}
