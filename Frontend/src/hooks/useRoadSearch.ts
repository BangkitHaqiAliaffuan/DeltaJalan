/**
 * useRoadSearch
 *
 * Hook untuk autocomplete nama jalan menggunakan LocationIQ Autocomplete API.
 * Membatasi pencarian ke wilayah Sidoarjo (bounding box) agar hasil relevan.
 *
 * Fitur:
 * - Debounce 400ms agar tidak spam request ke LocationIQ
 * - Hanya cari jika query ≥ 3 karakter
 * - Normalisasi hasil ke format nama jalan yang konsisten
 * - Ekstrak kecamatan dari hasil dan cocokkan ke 18 kecamatan Sidoarjo
 * - Kembalikan koordinat lat/lng dari hasil yang dipilih user
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── Konstanta ──────────────────────────────────────────────────────────────

/** API key LocationIQ dari environment variable Vite */
const LOCATIONIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY as string;

/** Endpoint autocomplete LocationIQ */
const LOCATIONIQ_AUTOCOMPLETE_URL = "https://us1.locationiq.com/v1/autocomplete";

/** Endpoint reverse geocoding LocationIQ (untuk resolve koordinat dari place_id) */
const LOCATIONIQ_REVERSE_URL = "https://us1.locationiq.com/v1/reverse";

/** Debounce delay dalam ms */
const DEBOUNCE_MS = 400;

/** Minimum karakter sebelum mulai search */
const MIN_QUERY_LENGTH = 3;

/**
 * Bounding box Kabupaten Sidoarjo.
 * Format LocationIQ viewbox: lng_min,lat_min,lng_max,lat_max
 */
const SIDOARJO_VIEWBOX = "112.50,-7.65,112.95,-7.25";

/** 18 kecamatan Sidoarjo */
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

export interface RoadSuggestion {
  /** Nama jalan yang sudah dinormalisasi, siap disimpan ke database */
  roadName: string;
  /** Kecamatan yang terdeteksi (null jika tidak dikenali) */
  kecamatan: string | null;
  /** Koordinat GPS */
  lat: number;
  lng: number;
  /** Label lengkap untuk ditampilkan di dropdown */
  displayLabel: string;
  /** ID unik untuk key React */
  placeId: string;
}

export type RoadSearchStatus =
  | "idle"
  | "searching"
  | "found"
  | "not_found"
  | "error";

export interface UseRoadSearchReturn {
  status: RoadSearchStatus;
  suggestions: RoadSuggestion[];
  showSuggestions: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (suggestion: RoadSuggestion) => void;
  onDismiss: () => void;
  reset: () => void;
}

// ── Helper ─────────────────────────────────────────────────────────────────

/** Cocokkan string ke salah satu dari 18 kecamatan Sidoarjo */
function matchKecamatan(raw: string): string | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/kecamatan\s*/i, "").trim();
  if (KECAMATAN_MAP[normalized]) return KECAMATAN_MAP[normalized];
  for (const [key, value] of Object.entries(KECAMATAN_MAP)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

// ── LocationIQ API Types ───────────────────────────────────────────────────

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
  [key: string]: string | undefined;
}

interface LocationIQAutocompleteResult {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
  display_place?: string;
  display_address?: string;
  address: LocationIQAddress;
  type: string;
  class: string;
}

// ── LocationIQ Search ──────────────────────────────────────────────────────

async function searchLocationIQ(query: string): Promise<RoadSuggestion[]> {
  const url = new URL(LOCATIONIQ_AUTOCOMPLETE_URL);
  url.searchParams.set("key", LOCATIONIQ_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "7");
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("viewbox", SIDOARJO_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("accept-language", "id");
  // Fokus ke tipe jalan agar hasil lebih relevan
  url.searchParams.set("tag", "highway:*,place:*");

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`LocationIQ autocomplete error: ${res.status}`);
  }

  const data: LocationIQAutocompleteResult[] = await res.json();

  const suggestions: RoadSuggestion[] = [];

  for (const item of data) {
    const addr = item.address ?? {};

    // Ambil nama jalan dari address.road (paling konsisten untuk database)
    const road = addr.road?.trim() ?? "";

    // Jika tidak ada road, coba ambil dari display_place sebagai fallback
    const roadName = road || item.display_place?.trim() || "";

    if (!roadName) continue;

    // Kecamatan dari city_district atau suburb (sesuai struktur LocationIQ Sidoarjo)
    const kecRaw =
      addr.city_district ??
      addr.suburb ??
      addr.town ??
      addr.village ??
      "";
    const kecamatan = matchKecamatan(kecRaw);

    // Label tampilan: "Nama Jalan, Kec. X, Sidoarjo"
    const labelParts: string[] = [roadName];
    if (kecamatan) labelParts.push(`Kec. ${kecamatan}`);
    labelParts.push("Sidoarjo");
    const displayLabel = labelParts.join(", ");

    suggestions.push({
      roadName,
      kecamatan,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayLabel,
      placeId: item.place_id,
    });
  }

  // Deduplikasi berdasarkan roadName + kecamatan
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = `${s.roadName.toLowerCase()}|${s.kecamatan ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useRoadSearch(
  onSelect: (suggestion: RoadSuggestion) => void
): UseRoadSearchReturn {
  const [status, setStatus] = useState<RoadSearchStatus>("idle");
  const [suggestions, setSuggestions] = useState<RoadSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onQueryChange = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < MIN_QUERY_LENGTH) {
      setStatus("idle");
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setStatus("searching");

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        const results = await searchLocationIQ(query);
        setSuggestions(results);
        setStatus(results.length > 0 ? "found" : "not_found");
        setShowSuggestions(results.length > 0);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("LocationIQ search error:", err);
        setStatus("error");
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const handleSelect = useCallback(
    (suggestion: RoadSuggestion) => {
      setSuggestions([]);
      setShowSuggestions(false);
      setStatus("idle");
      onSelect(suggestion);
    },
    [onSelect]
  );

  const onDismiss = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setStatus("idle");
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    status,
    suggestions,
    showSuggestions,
    onQueryChange,
    onSelect: handleSelect,
    onDismiss,
    reset,
  };
}
