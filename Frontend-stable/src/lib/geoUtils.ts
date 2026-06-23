export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getStaFromGps(
  lat: number,
  lng: number,
  geometry: [number, number][]
): { sta: number; label: string; distToRoad: number } | null {
  if (!geometry || geometry.length < 2) return null;
  let minDistToRoad = Infinity;
  let bestSta = 0;
  let cumulativeLen = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];
    const segLen = haversineMeters(a[0], a[1], b[0], b[1]);
    const denom = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t = denom === 0 ? 0 : clamp(
      ((lat - a[0]) * (b[0] - a[0]) + (lng - a[1]) * (b[1] - a[1])) / denom,
      0, 1
    );
    const projLat = a[0] + t * (b[0] - a[0]);
    const projLng = a[1] + t * (b[1] - a[1]);
    const distToRoad = haversineMeters(lat, lng, projLat, projLng);
    if (distToRoad < minDistToRoad) {
      minDistToRoad = distToRoad;
      bestSta = cumulativeLen + (t * segLen);
    }
    cumulativeLen += segLen;
  }
  const km = Math.floor(bestSta / 1000);
  const m = Math.round(bestSta % 1000);
  return {
    sta: Math.round(bestSta),
    label: `KM ${km}+${String(m).padStart(3, "0")}`,
    distToRoad: Math.round(minDistToRoad),
  };
}

export function dedupGps(
  points: Array<{ lat: number; lng: number }>,
  thresholdMeters = 20
): Array<{ lat: number; lng: number }> {
  const result: Array<{ lat: number; lng: number }> = [];
  for (const p of points) {
    const isDuplicate = result.some(
      (r) => haversineMeters(r.lat, r.lng, p.lat, p.lng) < thresholdMeters
    );
    if (!isDuplicate) result.push(p);
  }
  return result;
}
