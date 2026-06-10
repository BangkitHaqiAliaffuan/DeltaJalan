/**
 * useLocationFromPhoto
 *
 * Hook untuk mendapatkan koordinat GPS dari foto:
 *
 * 1. CAPACITOR → PhotoExifGps.pickPhotos() — batch native picker + EXIF GPS
 * 2. EXIF      → exifr.gps(file) — EXIF foto (desktop / Samsung)
 * 3. SERVER    → readExifGpsFromServer(file) — PHP PEL fallback
 * 4. GEOLOCATION → navigator.geolocation.getCurrentPosition() — Android fallback
 * 5. REVERSE GEOCODING — chain 3 service:
 *    a. LocationIQ (road/path/pedestrian/cycleway/footway) + kecamatan
 *    b. OSRM Nearest (snapped road name dari routing graph)
 *    c. Overpass API (raw OSM query — nearest named highway dalam 100m)
 * 6. MANUAL → user isi lewat autocomplete
 */

import { useState, useCallback } from "react";
import exifr from "exifr";
import { snapToRoad } from "@/lib/geo";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken } from "@/lib/auth";

/** Capacitor hanya tersedia di native — dicek via global window tanpa import */
function isNativePlatform(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Record<string, unknown>).Capacitor !== "undefined" &&
    typeof (window as Record<string, unknown>).Capacitor === "object" &&
    typeof (window as Record<string, unknown>).Capacitor !== null
  );
}

interface PhotoExifGpsPlugin {
  pickPhotos: (options: { limit: number }) => Promise<{
    photos: Array<{
      fileName: string;
      filePath: string;
      previewUrl: string;
      lat: number | null;
      lng: number | null;
    }>;
  }>;
}

export interface NativePhoto {
  fileName: string;
  filePath: string;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  /** Convert file:// path jadi asset:// path untuk ditampilkan di <img> */
  src: string;
}

let photoExifPlugin: PhotoExifGpsPlugin | null = null;

async function getPhotoExifPlugin(): Promise<PhotoExifGpsPlugin | null> {
  if (photoExifPlugin) return photoExifPlugin;
  if (!isNativePlatform()) return null;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    photoExifPlugin = registerPlugin("PhotoExifGps") as unknown as PhotoExifGpsPlugin;
    return photoExifPlugin;
  } catch {
    return null;
  }
}

function convertFileSrc(filePath: string): string {
  if (!isNativePlatform()) return filePath;
  // convertFileSrc only available after @capacitor/core is loaded
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.Capacitor?.convertFileSrc) {
      return w.Capacitor.convertFileSrc(filePath);
    }
  } catch {}
  return filePath;
}

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

export type LocationSource = "exif" | "manual" | "geolocation" | "native" | null;

export type GpsStatus =
  | "idle"
  | "detecting" // sedang mengambil koordinat
  | "geocoding" // sedang reverse geocoding
  | "success" // berhasil auto-fill dengan nama jalan
  | "success_no_road" // koordinat didapat tapi nama jalan kosong (user isi manual)
  | "exif_no_gps" // foto galeri tidak punya GPS EXIF
  | "auto_geolocating" // auto-geolocation fallback
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
  /**
   * Panggil ini di Capacitor native — membuka system file picker
   * dan mengembalikan foto + GPS langsung dari plugin.
   */
  handleNativePick: (limit?: number) => Promise<NativePhoto[]>;
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
  } catch (err) {
    console.warn("[readExifGps] Gagal baca EXIF GPS:", err);
    return null;
  }
}

/**
 * Fallback: upload foto ke server, biar PHP exif_read_data() yang baca GPS.
 * Mobile browser (iOS Safari, Android Chrome) sering strip EXIF GPS dari File object,
 * tapi data asli tetap utuh pas dikirim ke server.
 */
/**
 * Auto-geolocation fallback untuk Android.
 * Di-call setelah server-side EXIF extraction gagal.
 */
export function getBrowserLocation(options?: {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}): Promise<ExifGps | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("[getBrowserLocation] Geolocation tidak tersedia");
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn(`[getBrowserLocation] ${err.code}: ${err.message}`);
        resolve(null);
      },
      {
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 60000,
        enableHighAccuracy: options?.enableHighAccuracy ?? false,
      },
    );
  });
}

export async function readExifGpsFromServer(file: File, signal?: AbortSignal): Promise<ExifGps | null> {
  const token = getToken();
  const fd = new FormData();
  fd.append("image", file);
  try {
    const res = await fetch(`${API_BASE_URL}/v1/reports/extract-exif-gps`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[readExifGpsFromServer] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { latitude: data.lat, longitude: data.lng };
    }
    return null;
  } catch (err) {
    console.warn("[readExifGpsFromServer] Gagal:", err);
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

  /** STRATEGI 1: Foto dari kamera → baca EXIF GPS → server fallback → browser geolocation */
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

      let gps = await readExifGps(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      // 2nd attempt: server-side EXIF
      setLocationState(prev => ({
        ...prev,
        statusMessage: "Mengambil data GPS dari foto...",
      }));
      gps = await readExifGpsFromServer(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      // 3rd attempt: auto-geolocation fallback
      setLocationState(prev => ({
        ...prev,
        status: "auto_geolocating",
        statusMessage: "Mendeteksi lokasi perangkat...",
      }));
      gps = await getBrowserLocation({ timeout: 10000 });

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "geolocation");
        return;
      }

      setLocationState({
        lat: null,
        lng: null,
        source: "exif",
        status: "exif_no_gps",
        statusMessage: "Foto tidak memiliki data GPS. Cari nama jalan via autocomplete.",
        roadNameLocked: false,
      });
      onLocationFailed("exif_no_gps");
    },
    [processCoordinates, onLocationFailed],
  );

  /** STRATEGI 2: Foto dari galeri → baca EXIF GPS → server fallback → browser geolocation */
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

      let gps = await readExifGps(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      setLocationState(prev => ({
        ...prev,
        statusMessage: "Mengambil data GPS dari foto...",
      }));
      gps = await readExifGpsFromServer(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      setLocationState(prev => ({
        ...prev,
        status: "auto_geolocating",
        statusMessage: "Mendeteksi lokasi perangkat...",
      }));
      gps = await getBrowserLocation({ timeout: 10000 });

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "geolocation");
        return;
      }

      setLocationState({
        lat: null,
        lng: null,
        source: "exif",
        status: "exif_no_gps",
        statusMessage: "Foto tidak memiliki data GPS. Cari nama jalan via autocomplete.",
        roadNameLocked: false,
      });
      onLocationFailed("exif_no_gps");
    },
    [processCoordinates, onLocationFailed],
  );

  /** STRATEGI 3: Capacitor native — pick photos langsung dari plugin dengan GPS */
  const handleNativePick = useCallback(async (limit: number = 1): Promise<NativePhoto[]> => {
    const plugin = await getPhotoExifPlugin();
    if (!plugin) {
      console.warn("[handleNativePick] Capacitor plugin tidak tersedia");
      return [];
    }

    setLocationState({
      lat: null,
      lng: null,
      source: "native",
      status: "detecting",
      statusMessage: "Memilih foto...",
      roadNameLocked: false,
    });

    try {
      const result = await plugin.pickPhotos({ limit });
      const photosWithSrc: NativePhoto[] = result.photos.map((p) => ({
        ...p,
        src: convertFileSrc(p.filePath),
      }));

      // Kalau single pick, proses koordinat foto pertama untuk auto-fill
      if (limit === 1 && photosWithSrc.length > 0) {
        const first = photosWithSrc[0];
        if (first.lat != null && first.lng != null) {
          await processCoordinates(first.lat, first.lng, "native");
        } else {
          setLocationState({
            lat: null,
            lng: null,
            source: "native",
            status: "exif_no_gps",
            statusMessage: "Foto tidak memiliki data GPS.",
            roadNameLocked: false,
          });
        }
      }

      return photosWithSrc;
    } catch (err) {
      console.warn("[handleNativePick] Gagal:", err);
      setLocationState(prev => ({
        ...prev,
        status: "error",
        statusMessage: "Gagal membuka pemilih foto native",
      }));
      return [];
    }
  }, [processCoordinates]);

  const resetLocation = useCallback(() => {
    setLocationState(INITIAL_STATE);
  }, []);

  return { locationState, handleCameraCapture, handleGallerySelect, handleNativePick, resetLocation };
}
