/**
 * useGPS.ts
 *
 * Custom hook untuk mendapatkan koordinat GPS dari browser dengan deteksi fake GPS.
 *
 * Fitur:
 * - watchPosition untuk update koordinat secara real-time
 * - Deteksi fake GPS berdasarkan pola akurasi yang tidak wajar
 * - Status tracking: idle → waiting → active / error / denied
 *
 * Digunakan oleh halaman upload batch untuk mendapatkan koordinat live
 * tanpa bergantung pada EXIF foto.
 */

import { useState, useEffect, useRef } from "react";

export type GPSStatus = "idle" | "waiting" | "active" | "error" | "denied";

export interface GPSData {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: GPSStatus;
  koordinat_sumber: "browser_gps" | "manual";
  fake_gps_suspected: boolean;
  fake_gps_reasons: string[];
}

export interface UseGPSReturn {
  gps: GPSData;
  startWatching: () => void;
  stopWatching: () => void;
}

export function useGPS(): UseGPSReturn {
  const [gps, setGPS] = useState<GPSData>({
    lat: null,
    lng: null,
    accuracy: null,
    status: "idle",
    koordinat_sumber: "manual",
    fake_gps_suspected: false,
    fake_gps_reasons: [],
  });

  const accuracyHistory = useRef<number[]>([]);
  const watchId = useRef<number | null>(null);

  /**
   * Deteksi indikasi fake GPS berdasarkan pola akurasi.
   *
   * Tiga indikator:
   * 1. Akurasi terlalu konstan (spread < 0.5 dalam 5 pembacaan terakhir)
   *    → Mock location app biasanya menghasilkan nilai yang persis sama
   * 2. Akurasi < 1 meter → tidak wajar untuk GPS smartphone biasa
   * 3. Altitude null padahal akurasi tinggi → GPS palsu sering tidak punya altitude
   */
  const detectFakeGPS = (pos: GeolocationPosition): string[] => {
    const reasons: string[] = [];
    const acc = pos.coords.accuracy;

    // Rekam riwayat akurasi
    accuracyHistory.current.push(acc);

    // Cek spread akurasi dalam 5 pembacaan terakhir
    if (accuracyHistory.current.length >= 5) {
      const recent = accuracyHistory.current.slice(-5);
      const spread = Math.max(...recent) - Math.min(...recent);
      if (spread < 0.5) {
        reasons.push("akurasi_terlalu_konstan");
      }
    }

    // Akurasi < 1 meter tidak wajar untuk GPS biasa
    if (acc < 1) {
      reasons.push("akurasi_tidak_wajar");
    }

    // Altitude null padahal akurasi tinggi (< 20m)
    if (pos.coords.altitude === null && acc < 20) {
      reasons.push("altitude_tidak_ada");
    }

    return reasons;
  };

  const pausedRef = useRef(false);

  const startWatching = () => {
    if (!navigator.geolocation) {
      setGPS((prev) => ({ ...prev, status: "error" }));
      return;
    }
    if (watchId.current !== null) return;

    accuracyHistory.current = [];
    setGPS((prev) => ({ ...prev, status: "waiting" }));

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reasons = detectFakeGPS(pos);
        setGPS({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: "active",
          koordinat_sumber: "browser_gps",
          fake_gps_suspected: reasons.length > 0,
          fake_gps_reasons: reasons,
        });
      },
      (err) => {
        setGPS((prev) => ({
          ...prev,
          status: err.code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "error",
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  };

  const stopWatching = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  // Pause GPS saat page hidden, resume saat visible
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        stopWatching();
        pausedRef.current = true;
      } else if (pausedRef.current) {
        pausedRef.current = false;
        startWatching();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { gps, startWatching, stopWatching };
}
