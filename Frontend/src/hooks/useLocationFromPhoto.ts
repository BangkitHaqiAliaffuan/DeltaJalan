/**
 * useLocationFromPhoto
 *
 * Hook yang mengimplementasikan strategi hybrid untuk mendapatkan koordinat GPS:
 *
 * 1. KAMERA  → navigator.geolocation.getCurrentPosition (live GPS)
 * 2. GALERI  → exifr.gps(file) untuk membaca metadata EXIF foto
 * 3. REVERSE GEOCODING → LocationIQ API untuk mengisi nama jalan & kecamatan
 *    - Jika address.road ditemukan → isi nama jalan dan set readOnly
 *    - Jika address.road kosong    → kosongkan nama jalan, biarkan user isi manual
 * 4. FALLBACK → notifikasi agar user cari jalan via autocomplete
 */

import { useState, useCallback } from "react";
import exifr from "exifr";

// ── Konstanta ──────────────────────────────────────────────────────────────

/** API key LocationIQ dari environment variable Vite */
const LOCATIONIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY as string;

/** Endpoint reverse geocoding LocationIQ */
const LOCATIONIQ_REVERSE_URL = "https://us1.locationiq.com/v1/reverse";

/** 18 kecamatan Sidoarjo beserta alias yang mungkin muncul dari LocationIQ */
const KECAMATAN_MAP: Record<string, string> = {
  sidoarjo:     "Sidoarjo",
  buduran:      "Buduran",
  gedangan:     "Gedangan",
  sedati:       "Sedati",
  waru:         "Waru",
  taman:        "Taman",
  krian:        "Krian",
  balongbendo:  "Balongbendo",
  wonoayu:      "Wonoayu",
  sukodono:     "Sukodono",
  candi:        "Candi",
  tarik:        "Tarik",
  prambon:      "Prambon",
  porong:       "Porong",
  krembung:     "Krembung",
  tulangan:     "Tulangan",
  tanggulangin: "Tanggulangin",
  jabon:        "Jabon",
};

// ── Types ──────────────────────────────────────────────────────────────────

export type LocationSource = "camera" | "exif" | "manual" | null;

export type GpsStatus =
  | "idle"
  | "detecting"         // sedang mengambil koordinat
  | "geocoding"         // sedang reverse geocoding
  | "success"           // berhasil auto-fill dengan nama jalan
  | "success_no_road"   // koordinat didapat tapi nama jalan kosong (user isi manual)
  | "exif_no_gps"       // foto galeri tidak punya GPS EXIF
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

interface ReverseGeocodeResult {
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
  const normalized = raw.toLowerCase().replace(/kecamatan\s*/i, "").trim();
  if (KECAMATAN_MAP[normalized]) return KECAMATAN_MAP[normalized];
  for (const [key, value] of Object.entries(KECAMATAN_MAP)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

/**
 * Reverse geocoding menggunakan LocationIQ API.
 *
 * Logika nama jalan:
 * - Jika address.road ada dan tidak kosong → roadFound=true, namaJalan=road (+ nomor jika ada)
 * - Jika address.road kosong → roadFound=false, namaJalan="" (user isi manual)
 */
async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
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

  // ── Nama Jalan ────────────────────────────────────────────────────────────
  // Prioritas: road (paling spesifik) → tidak ada fallback ke neighbourhood/suburb
  // agar data di database tetap konsisten (hanya nama jalan resmi)
  const road = addr.road?.trim() ?? "";
  let namaJalan = "";
  let roadFound = false;

  if (road) {
    roadFound = true;
    const parts = [road];
    if (addr.house_number) parts.push(`No. ${addr.house_number}`);
    namaJalan = parts.join(" ");
  }
  // Jika road kosong → namaJalan tetap "" dan roadFound=false
  // UI akan membuka field agar user bisa ketik nama gang/jalan secara manual

  // ── Kecamatan ─────────────────────────────────────────────────────────────
  // LocationIQ untuk Sidoarjo biasanya menaruh kecamatan di city_district atau suburb
  const kecamatanRaw =
    addr.city_district ??
    addr.suburb ??
    addr.town ??
    addr.village ??
    addr.county ??
    "";
  const kecamatan = matchKecamatan(kecamatanRaw);

  return { namaJalan, roadFound, kecamatan };
}

// ── Helper: HTML5 Geolocation ─────────────────────────────────────────────

function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser ini."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      }
    );
  });
}

// ── Helper: EXIF GPS dari file ────────────────────────────────────────────

interface ExifGps {
  latitude: number;
  longitude: number;
}

async function readExifGps(file: File): Promise<ExifGps | null> {
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
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
    roadNameLocked: boolean
  ) => void,
  onLocationFailed: (reason: GpsStatus) => void
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
          ? `Lokasi terdeteksi via ${source === "camera" ? "GPS kamera" : "EXIF foto"}`
          : `Koordinat didapat, nama jalan tidak ditemukan — isi manual`;

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
    [onLocationResolved]
  );

  /** STRATEGI 1: Foto dari kamera → gunakan live GPS */
  const handleCameraCapture = useCallback(
    async (_file: File) => {
      setLocationState({
        lat: null,
        lng: null,
        source: "camera",
        status: "detecting",
        statusMessage: "Mengambil koordinat GPS...",
        roadNameLocked: false,
      });

      try {
        const coords = await getCurrentPosition();
        await processCoordinates(coords.latitude, coords.longitude, "camera");
      } catch (err) {
        let status: GpsStatus = "error";
        let msg = "Gagal mendapatkan lokasi GPS.";

        if (err instanceof GeolocationPositionError) {
          if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
            status = "permission_denied";
            msg = "Izin lokasi ditolak. Aktifkan GPS di pengaturan browser.";
          } else if (err.code === GeolocationPositionError.TIMEOUT) {
            status = "timeout";
            msg = "GPS timeout. Cari nama jalan via autocomplete.";
          }
        }

        setLocationState({
          lat: null, lng: null, source: "camera",
          status, statusMessage: msg, roadNameLocked: false,
        });
        onLocationFailed(status);
      }
    },
    [processCoordinates, onLocationFailed]
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
    [processCoordinates, onLocationFailed]
  );

  const resetLocation = useCallback(() => {
    setLocationState(INITIAL_STATE);
  }, []);

  return { locationState, handleCameraCapture, handleGallerySelect, resetLocation };
}
