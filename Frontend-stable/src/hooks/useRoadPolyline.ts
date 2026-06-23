import { getBbox } from "@/lib/kecamatanBbox";
import { getFromCache, saveToCache } from "@/lib/polylineCache";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const LIQ_SEARCH_URL = "https://us1.locationiq.com/v1/search";
const LIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY;

export async function getRoadPolyline(
  roadName: string,
  kecamatan: string
): Promise<{ geometry: [number, number][]; source: string } | null> {
  if (!roadName || !kecamatan) return null;

  const cacheKey = `${roadName}::${kecamatan}`;

  const cached = await getFromCache(cacheKey);
  if (cached) return { geometry: cached, source: "cache" };

  const osm = await fetchFromOSM(roadName, kecamatan);
  if (osm) {
    await saveToCache(cacheKey, osm);
    return { geometry: osm, source: "osm" };
  }

  const nom = await fetchFromNominatim(roadName, kecamatan);
  if (nom) {
    await saveToCache(cacheKey, nom);
    return { geometry: nom, source: "nominatim" };
  }

  const liq = await fetchFromLocationIQ(roadName, kecamatan);
  if (liq) {
    await saveToCache(cacheKey, liq);
    return { geometry: liq, source: "locationiq" };
  }

  return null;
}

async function fetchFromOSM(
  roadName: string,
  kecamatan: string
): Promise<[number, number][] | null> {
  const bbox = getBbox(kecamatan);
  if (!bbox) return null;

  const variations = [
    roadName,
    roadName.replace(/^Jl\.\s*/i, "Jalan "),
    roadName.replace(/^Jl\.\s*/i, ""),
    roadName.replace(/[-–—]+/g, " ").replace(/\s+/g, " "),
  ];

  for (const name of [...new Set(variations)]) {
    const query = `
      [out:json][timeout:10];
      way["name"~"${name.replace(/"/g, '\\"')}",i](${bbox});
      out geom;
    `;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const json = await res.json();
      if (json.elements?.length > 0) {
        const way = json.elements[0];
        if (way.geometry?.length >= 2) {
          return way.geometry.map((g: { lat: number; lon: number }) => [g.lat, g.lon]);
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchFromNominatim(
  roadName: string,
  kecamatan: string
): Promise<[number, number][] | null> {
  const q = `${roadName}, ${kecamatan}, Sidoarjo, Indonesia`;
  try {
    const res = await fetch(
      `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=1`,
      { headers: { "User-Agent": "DeltaJalan/1.0" } }
    );
    const json = await res.json();
    if (!json?.length) return null;
    return extractGeoJsonPolyline(json[0]?.geojson);
  } catch {
    return null;
  }
}

async function fetchFromLocationIQ(
  roadName: string,
  kecamatan: string
): Promise<[number, number][] | null> {
  if (!LIQ_KEY) return null;
  const q = `${roadName}, ${kecamatan}, Sidoarjo, Indonesia`;
  try {
    const res = await fetch(
      `${LIQ_SEARCH_URL}?key=${LIQ_KEY}&q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=1`
    );
    const json = await res.json();
    if (!json?.length) return null;
    return extractGeoJsonPolyline(json[0]?.geojson);
  } catch {
    return null;
  }
}

function extractGeoJsonPolyline(
  geojson: { type: string; coordinates: unknown } | undefined
): [number, number][] | null {
  if (!geojson?.coordinates) return null;
  const coords = geojson.coordinates as unknown;
  let points: number[][] = [];

  if (Array.isArray(coords)) {
    if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
      points = coords as number[][];
    } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      points = (coords as number[][][])[0];
    }
  }

  if (points.length < 2) return null;
  return points.map((c) => [c[1], c[0]]);
}

export async function getPolylineWithCache(
  roadName: string,
  kecamatan: string
): Promise<[number, number][] | null> {
  const result = await getRoadPolyline(roadName, kecamatan);
  return result?.geometry ?? null;
}
