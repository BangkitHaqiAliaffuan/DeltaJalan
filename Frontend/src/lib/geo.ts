const OSRM_NEAREST_URL = "https://router.project-osrm.org/nearest/v1/driving";

export async function snapToRoad(
  lat: number,
  lng: number,
): Promise<{ lat: number; lng: number; roadName: string }> {
  try {
    const url = `${OSRM_NEAREST_URL}/${lng},${lat}?number=1`;
    const res = await fetch(url);
    if (!res.ok) return { lat, lng, roadName: "" };
    const data = await res.json();
    if (data.code !== "Ok" || !data.waypoints?.length) return { lat, lng, roadName: "" };
    const wp = data.waypoints[0];
    return { lat: wp.location[1], lng: wp.location[0], roadName: wp.name ?? "" };
  } catch {
    return { lat, lng, roadName: "" };
  }
}

export async function snapToRoadBatch(
  points: { lat: number; lng: number }[],
): Promise<{ lat: number; lng: number; roadName: string }[]> {
  return Promise.all(points.map((p) => snapToRoad(p.lat, p.lng)));
}
