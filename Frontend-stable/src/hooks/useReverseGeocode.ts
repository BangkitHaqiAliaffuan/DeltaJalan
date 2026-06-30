const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const LIQ_REVERSE_URL = "https://us1.locationiq.com/v1/reverse";
const LIQ_KEY = import.meta.env.VITE_LOCATIONIQ_KEY;

export async function getRoadNameFromGps(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_REVERSE_URL}?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { "User-Agent": "DeltaJalan/1.0" } },
    );
    if (res.ok) {
      const data = await res.json();
      const road = data?.address?.road;
      if (road) return normalizeRoadName(road);
    }
  } catch {}

  if (LIQ_KEY) {
    try {
      const res = await fetch(
        `${LIQ_REVERSE_URL}?key=${LIQ_KEY}&lat=${lat}&lon=${lng}&format=json&zoom=16`,
      );
      if (res.ok) {
        const data = await res.json();
        const road = data?.address?.road ?? data?.address?.pedestrian;
        if (road) return normalizeRoadName(road);
      }
    } catch {}
  }

  return null;
}

function normalizeRoadName(name: string): string {
  return name
    .replace(/^Jalan\s+/i, "Jl. ")
    .replace(/\s+/g, " ")
    .trim();
}
