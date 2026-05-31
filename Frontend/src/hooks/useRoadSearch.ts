/**
 * useRoadSearch
 *
 * Hook untuk autocomplete nama jalan menggunakan LocationIQ Autocomplete API.
 * Membatasi hasil ke wilayah Kabupaten Sidoarjo dengan dua lapisan filter:
 *
 * 1. Server-side: viewbox + bounded=1 agar LocationIQ memprioritaskan Sidoarjo
 * 2. Client-side: buang semua hasil yang koordinatnya di luar bounding box Sidoarjo
 *    → Ini yang mencegah "Jl. Gajah Mada Mojokerto" masuk ke hasil
 *
 * Fitur:
 * - Debounce 400ms
 * - Hanya cari jika query ≥ 3 karakter
 * - Normalisasi nama jalan
 * - Ekstrak kecamatan dari hasil
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── Konstanta ──────────────────────────────────────────────────────────────

const LOCATIONIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY as string;
const LOCATIONIQ_AUTOCOMPLETE_URL = "https://us1.locationiq.com/v1/autocomplete";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

/**
 * Bounding box Kabupaten Sidoarjo (sedikit diperlebar agar jalan di perbatasan masuk).
 * Format LocationIQ viewbox: "lng_min,lat_min,lng_max,lat_max"
 *
 * Koordinat referensi:
 *   Barat  : 112.50  Timur : 112.95
 *   Selatan: -7.65   Utara : -7.25
 */
const SIDOARJO_BBOX = {
  lngMin: 112.5,
  lngMax: 112.95,
  latMin: -7.65,
  latMax: -7.25,
};

/** Format viewbox untuk LocationIQ */
const SIDOARJO_VIEWBOX = `${SIDOARJO_BBOX.lngMin},${SIDOARJO_BBOX.latMin},${SIDOARJO_BBOX.lngMax},${SIDOARJO_BBOX.latMax}`;

/** 18 kecamatan Sidoarjo */
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

export interface RoadSuggestion {
  roadName: string;
  kecamatan: string | null;
  lat: number;
  lng: number;
  displayLabel: string;
  placeId: string;
}

export type RoadSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

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

/** Cek apakah koordinat berada di dalam bounding box Sidoarjo */
function isInSidoarjoBbox(lat: number, lng: number): boolean {
  return (
    lat >= SIDOARJO_BBOX.latMin &&
    lat <= SIDOARJO_BBOX.latMax &&
    lng >= SIDOARJO_BBOX.lngMin &&
    lng <= SIDOARJO_BBOX.lngMax
  );
}

/** Cocokkan string ke salah satu dari 18 kecamatan Sidoarjo */
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

interface LocationIQResult {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
  display_place?: string;
  address: LocationIQAddress;
}

// ── LocationIQ Search ──────────────────────────────────────────────────────

async function searchLocationIQ(query: string): Promise<RoadSuggestion[]> {
  const url = new URL(LOCATIONIQ_AUTOCOMPLETE_URL);
  url.searchParams.set("key", LOCATIONIQ_KEY);
  url.searchParams.set("q", `${query} Sidoarjo`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10"); // minta lebih banyak, nanti difilter
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("viewbox", SIDOARJO_VIEWBOX);
  url.searchParams.set("bounded", "1"); // server-side: prioritaskan dalam viewbox
  url.searchParams.set("accept-language", "id");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`LocationIQ error: ${res.status}`);

  const data: LocationIQResult[] = await res.json();
  const suggestions: RoadSuggestion[] = [];

  for (const item of data) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    // ── Filter client-side layer 1: koordinat di luar Sidoarjo ──────────
    if (!isInSidoarjoBbox(lat, lng)) continue;

    const addr = item.address ?? {};

    // ── Filter client-side layer 2: nama kota/kabupaten bukan Sidoarjo ──
    // Tangkap kasus di mana koordinat borderline tapi jelas bukan Sidoarjo
    const cityRaw = (addr.city ?? addr.county ?? addr.town ?? "").toLowerCase();
    if (cityRaw && !cityRaw.includes("sidoarjo")) continue;
    const road = addr.road?.trim() ?? "";
    const roadName = road || item.display_place?.trim() || "";
    if (!roadName) continue;

    const kecRaw =
      addr.city_district ??
      addr.suburb ??
      addr.town ??
      addr.village ??
      addr.city ??
      addr.county ??
      "";
    const kecamatan = matchKecamatan(kecRaw);

    const labelParts = [roadName];
    if (kecamatan) labelParts.push(`Kec. ${kecamatan}`);
    labelParts.push("Sidoarjo");

    suggestions.push({
      roadName,
      kecamatan,
      lat,
      lng,
      displayLabel: labelParts.join(", "),
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

export function useRoadSearch(onSelect: (suggestion: RoadSuggestion) => void): UseRoadSearchReturn {
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
    [onSelect],
  );

  const onDismiss = useCallback(() => setShowSuggestions(false), []);

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
