import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface PatrolMapProps {
  kecamatan: string;
  height?: string;
}

export function PatrolMap({ kecamatan, height = "240px" }: PatrolMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const polygonRef = useRef<import("leaflet").GeoJSON | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch("/data/sidoarjo-kecamatan.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Gagal memuat data kecamatan"))))
      .then((data) => {
        if (!cancelled) {
          setGeoJsonData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Terjadi kesalahan");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !kecamatan || loading || !geoJsonData) return;

    const feature = geoJsonData?.features?.find(
      (f: any) => f?.properties?.kecamatan?.toLowerCase() === kecamatan.toLowerCase(),
    );

    if (mapInstanceRef.current && LRef.current) {
      if (polygonRef.current) {
        mapInstanceRef.current.removeLayer(polygonRef.current);
        polygonRef.current = null;
      }
      if (feature) {
        addPolygon(LRef.current, mapInstanceRef.current, feature);
      }
      return;
    }

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      LRef.current = L;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, { zoomControl: false }).setView([-7.45, 112.72], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      if (feature) {
        addPolygon(L, map, feature);
      }
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      LRef.current = null;
      polygonRef.current = null;
    };
  }, [kecamatan, loading, geoJsonData]);

  function addPolygon(L: typeof import("leaflet"), map: import("leaflet").Map, feature: any) {
    const layer = L.geoJSON(feature, {
      style: {
        fillColor: "#1e40af",
        fillOpacity: 0.15,
        color: "#1e40af",
        weight: 2,
        opacity: 0.8,
      },
    }).addTo(map);

    polygonRef.current = layer;
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 14, animate: false });
    }
  }

  if (loading) {
    return (
      <div
        className="w-full rounded-xl overflow-hidden border border-[#D0DAE8] bg-slate-100 animate-pulse flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-xs text-[#64748B]">Memuat peta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full rounded-xl overflow-hidden border border-[#D0DAE8] bg-slate-50 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-xs text-[#E11D48]">{error}</p>
      </div>
    );
  }

  if (
    geoJsonData &&
    !geoJsonData.features?.some(
      (f: any) => f?.properties?.kecamatan?.toLowerCase() === kecamatan.toLowerCase(),
    )
  ) {
    return (
      <div
        className="w-full rounded-xl overflow-hidden border border-[#D0DAE8] bg-slate-50 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-xs text-[#64748B]">Batas kecamatan tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-[#D0DAE8]"
      style={{ height }}
    />
  );
}
