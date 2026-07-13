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
import { PhotoExifGps } from "@jalankita/capacitor-exif-gps";

/** Capacitor hanya tersedia di native — dicek via global window tanpa import */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return typeof w.Capacitor !== "undefined" && w.Capacitor?.isNativePlatform?.() === true;
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

export function convertFileSrc(filePath: string): string {
  if (!isNativePlatform()) return filePath;
  // convertFileSrc only available after @capacitor/core is loaded
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.Capacitor?.convertFileSrc) {
      return w.Capacitor.convertFileSrc(filePath);
    }
  } catch {
    // fallback — return original path
  }
  return filePath;
}

/**
 * STRATEGI 4: Capacitor native — ambil foto dari kamera via @capacitor/camera.
 * Kamera menyimpan ke file path langsung (bukan content URI), jadi EXIF GPS utuh.
 */
export async function nativeTakePhoto(): Promise<{
  file: File;
  lat: number | null;
  lng: number | null;
} | null> {
  if (!isNativePlatform()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

    const image = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      saveToGallery: false,
    });

    if (!image.webPath) return null;

    const response = await fetch(image.webPath);
    const blob = await response.blob();
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });

    const gps = await readExifGps(file);

    return {
      file,
      lat: gps?.latitude ?? null,
      lng: gps?.longitude ?? null,
    };
  } catch (err) {
    return null;
  }
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
  /**
   * Panggil ini di Capacitor native — ambil foto dari kamera via @capacitor/camera,
   * EXIF GPS utuh karena file di-save ke path langsung.
   */
  handleNativeTakePhoto: () => Promise<{
    file: File;
    lat: number | null;
    lng: number | null;
  } | null>;
  /** Reset state lokasi */
  resetLocation: () => void;
}

// ── Helper: LocationIQ Address ─────────────────────────────────────────────

interface LocationIQAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  municipality?: string;
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

export interface TierRawData {
  tier: number;
  name: string;
  success: boolean;
  rawAddress: Record<string, unknown> | null;
  rawJson: unknown;
}

export interface WilayahIdAdminData {
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kodePos: string | null;
}

export interface ReverseGeocodeResult {
  /** Nama jalan dari address.road — kosong string jika tidak ada */
  namaJalan: string;
  /** true jika address.road valid dan spesifik */
  roadFound: boolean;
  /** Kecamatan yang cocok dengan 18 kecamatan Sidoarjo */
  kecamatan: string | null;
  /** Dari wilayah-id enrichment */
  desa: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kodePos: string | null;
  /** Full address: "Jl. Raya Sidoarjo, Kedungpandan, Kec. Buduran, Kab. Sidoarjo, Jawa Timur 61252" */
  fullAddress: string | null;
  /** Raw responses from each tier for debugging */
  tiers: TierRawData[];
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

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

// ── Helper: Wilayah-id (Tier 5 enrichment) ──────────────────────────────

const WILAYAH_ID_URL = "https://wilayah-id-restapi.vercel.app/api/v1/boundaries/reverse";

interface WilayahIdResponse {
  province?: { name: string; code: string };
  regency?: { name: string; code: string; type: string };
  district?: { name: string; code: string };
  subdistrict?: { name: string; code: string; postal_code: string };
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function reverseGeocodeWilayahId(
  lat: number,
  lng: number,
): Promise<WilayahIdAdminData | null> {
  try {
    const url = new URL(WILAYAH_ID_URL);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      return null;
    }

    const data: WilayahIdResponse = await res.json();

    if (!data.subdistrict) return null;

    return {
      desa: data.subdistrict.name ? titleCase(data.subdistrict.name) : null,
      kecamatan: data.district?.name ? titleCase(data.district.name) : null,
      kabupaten: data.regency
        ? `${data.regency.type === "KOTA" ? "Kota" : "Kabupaten"} ${titleCase(data.regency.name)}`
        : null,
      provinsi: data.province?.name ? titleCase(data.province.name) : null,
      kodePos: data.subdistrict.postal_code ?? null,
    };
  } catch (err) {
    return null;
  }
}

function constructFullAddress(
  namaJalan: string,
  admin: WilayahIdAdminData | null,
  existingKecamatan: string | null,
): string | null {
  const parts: string[] = [];
  if (namaJalan) parts.push(namaJalan);
  if (admin?.desa) parts.push(admin.desa);
  if (admin?.kecamatan) parts.push(`Kec. ${admin.kecamatan}`);
  else if (existingKecamatan) parts.push(`Kec. ${existingKecamatan}`);
  if (admin?.kabupaten) parts.push(admin.kabupaten);
  if (admin?.provinsi) parts.push(admin.provinsi);
  if (admin?.kodePos) parts.push(admin.kodePos);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Reverse geocoding — 5-tier chain: Nominatim → LocationIQ → OSRM Nearest → Overpass API → Wilayah-id.
 * 4 road-name tiers (1-4), 1 admin enrichment tier (5).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  let namaJalan = "";
  let roadFound = false;
  let kecamatan: string | null = null;
  const tiers: TierRawData[] = [];

  // ── Tier 1: Nominatim ──────────────────────────────────────────────────
  // Nominatim pakai data OSM asli (tidak diturunkan seperti LocationIQ free tier).
  // Wajib set User-Agent sesuai kebijakan Nominatim.

  let tier1Raw: Record<string, unknown> | null = null;
  let tier1RawJson: unknown = null;
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lng.toString());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "id");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "DeltaJalan/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address ?? {};
      tier1Raw = addr as Record<string, unknown>;
      tier1RawJson = data;

      const road = addr.road ?? addr.pedestrian ?? addr.path ?? addr.cycleway ?? addr.footway ?? "";
      if (road) {
        roadFound = true;
        namaJalan = road.replace(/^Jalan\s+/i, "Jl. ").trim();
      } else {
        const areaFallback =
          addr.hamlet ?? addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.town ?? "";
        if (areaFallback) {
          namaJalan = areaFallback.trim();
        }
      }

      kecamatan = matchKecamatan(
        addr.city_district ??
          addr.suburb ??
          addr.municipality ??
          addr.neighbourhood ??
          addr.town ??
          addr.village ??
          addr.city ??
          addr.county ??
          "",
      );
      if (kecamatan) {
      }
    } else {
    }
  } catch (err) {}
  tiers.push({
    tier: 1,
    name: "Nominatim",
    success: !!tier1Raw,
    rawAddress: tier1Raw,
    rawJson: tier1RawJson,
  });

  // ── Tier 2: LocationIQ ──────────────────────────────────────────────────
  let tier2Raw: Record<string, unknown> | null = null;
  let tier2RawJson: unknown = null;
  if (!namaJalan) {
    try {
      const url = new URL(LOCATIONIQ_REVERSE_URL);
      url.searchParams.set("key", LOCATIONIQ_KEY);
      url.searchParams.set("lat", lat.toString());
      url.searchParams.set("lon", lng.toString());
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("zoom", "18");
      url.searchParams.set("accept-language", "id");

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });

      if (res.ok) {
        const data: LocationIQResponse = await res.json();
        const addr = data.address ?? {};
        tier2Raw = addr as Record<string, unknown>;
        tier2RawJson = data;

        const road = extractRoadFromLocationIQ(addr);
        if (road) {
          roadFound = true;
          const parts = [road];
          if (addr.house_number) parts.push(`No. ${addr.house_number}`);
          namaJalan = parts.join(" ");
        } else {
          const areaFallback =
            addr.hamlet ?? addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.town ?? "";
          if (areaFallback) {
            namaJalan = areaFallback.trim();
          }
        }

        if (!kecamatan) {
          kecamatan = matchKecamatan(
            addr.city_district ??
              addr.suburb ??
              addr.municipality ??
              addr.neighbourhood ??
              addr.town ??
              addr.village ??
              addr.city ??
              addr.county ??
              "",
          );
        }
        if (kecamatan) {
        }
      } else {
      }
    } catch (err) {}
  }
  tiers.push({
    tier: 2,
    name: "LocationIQ",
    success: !!tier2Raw,
    rawAddress: tier2Raw,
    rawJson: tier2RawJson,
  });

  // ── Tier 3: OSRM Nearest ───────────────────────────────────────────────
  let tier3RawJson: unknown = null;
  if (!namaJalan) {
    try {
      const osmResult = await snapToRoad(lat, lng);
      tier3RawJson = osmResult;
      if (osmResult.roadName) {
        namaJalan = osmResult.roadName;
        roadFound = true;
      } else {
      }
    } catch (e) {}
  }
  tiers.push({
    tier: 3,
    name: "OSRM Nearest",
    success: !!tier3RawJson,
    rawAddress: null,
    rawJson: tier3RawJson,
  });

  // ── Tier 4: Overpass API ───────────────────────────────────────────────
  let tier4RawJson: unknown = null;
  if (!namaJalan) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const overpassQuery = `[out:json][timeout:10];way(around:500,${lat},${lng})[highway][name];out 3;`;
      const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (overpassRes.ok) {
        const overpassData = await overpassRes.json();
        tier4RawJson = overpassData;
        const roadName = overpassData.elements?.[0]?.tags?.name;
        if (roadName) {
          namaJalan = roadName;
          roadFound = true;
        } else {
        }
      } else {
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
      } else {
      }
    }
  }
  tiers.push({
    tier: 4,
    name: "Overpass API",
    success: !!tier4RawJson,
    rawAddress: null,
    rawJson: tier4RawJson,
  });

  // ── Tier 5 (enrichment): Wilayah-id ──────────────────────────────────────
  // Not gated by !namaJalan — always runs to get admin hierarchy
  let tier5RawJson: unknown = null;
  let wilayahAdmin: WilayahIdAdminData | null = null;

  wilayahAdmin = await reverseGeocodeWilayahId(lat, lng);
  tier5RawJson = wilayahAdmin;

  if (wilayahAdmin) {
    if (wilayahAdmin.kecamatan && matchKecamatan(wilayahAdmin.kecamatan)) {
      kecamatan = matchKecamatan(wilayahAdmin.kecamatan);
    }
  }
  tiers.push({
    tier: 5,
    name: "Wilayah-id",
    success: !!wilayahAdmin,
    rawAddress: wilayahAdmin as unknown as Record<string, unknown> | null,
    rawJson: tier5RawJson,
  });

  // ── Construct full address ──────────────────────────────────────────────
  const fullAddress = constructFullAddress(namaJalan, wilayahAdmin, kecamatan);

  // ── Result ──────────────────────────────────────────────────────────────
  const result: ReverseGeocodeResult = {
    namaJalan,
    roadFound,
    kecamatan,
    desa: wilayahAdmin?.desa ?? null,
    kabupaten: wilayahAdmin?.kabupaten ?? null,
    provinsi: wilayahAdmin?.provinsi ?? null,
    kodePos: wilayahAdmin?.kodePos ?? null,
    fullAddress,
    tiers,
  };
  return result;
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

export async function readExifGpsFromServer(
  file: File,
  signal?: AbortSignal,
): Promise<ExifGps | null> {
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
      return null;
    }
    const data = await res.json();
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { latitude: data.lat, longitude: data.lng };
    }
    return null;
  } catch (err) {
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
      setLocationState((prev) => ({
        ...prev,
        statusMessage: "Mengambil data GPS dari foto...",
      }));
      gps = await readExifGpsFromServer(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      // 3rd attempt: auto-geolocation fallback
      setLocationState((prev) => ({
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

      setLocationState((prev) => ({
        ...prev,
        statusMessage: "Mengambil data GPS dari foto...",
      }));
      gps = await readExifGpsFromServer(file);

      if (gps) {
        await processCoordinates(gps.latitude, gps.longitude, "exif");
        return;
      }

      setLocationState((prev) => ({
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
  const handleNativePick = useCallback(
    async (limit: number = 1): Promise<NativePhoto[]> => {
      if (!isNativePlatform()) {
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
        const result = await PhotoExifGps.pickPhotos({ limit });
        const photosWithSrc: NativePhoto[] = result.photos.map((p) => {
          return {
            fileName: p.name,
            filePath: p.uri,
            previewUrl: p.uri,
            lat: p.lat,
            lng: p.lng,
            src: convertFileSrc(p.uri),
          };
        });

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
        setLocationState((prev) => ({
          ...prev,
          status: "error",
          statusMessage: "Gagal membuka pemilih foto native",
        }));
        return [];
      }
    },
    [processCoordinates],
  );

  /** STRATEGI 4: Capacitor native — ambil foto dari kamera dengan GPS */
  const handleNativeTakePhoto = useCallback(async (): Promise<{
    file: File;
    lat: number | null;
    lng: number | null;
  } | null> => {
    setLocationState({
      lat: null,
      lng: null,
      source: "native",
      status: "detecting",
      statusMessage: "Membuka kamera...",
      roadNameLocked: false,
    });

    const result = await nativeTakePhoto();

    if (result && result.lat != null && result.lng != null) {
      await processCoordinates(result.lat, result.lng, "native");
    } else if (result) {
      setLocationState({
        lat: null,
        lng: null,
        source: "native",
        status: "exif_no_gps",
        statusMessage: "Foto tidak memiliki data GPS.",
        roadNameLocked: false,
      });
    } else {
      setLocationState((prev) => ({
        ...prev,
        status: prev.lat ? "success" : "idle",
        statusMessage: prev.lat ? prev.statusMessage : "",
      }));
    }

    return result;
  }, [processCoordinates]);

  const resetLocation = useCallback(() => {
    setLocationState(INITIAL_STATE);
  }, []);

  return {
    locationState,
    handleCameraCapture,
    handleGallerySelect,
    handleNativePick,
    handleNativeTakePhoto,
    resetLocation,
  };
}
