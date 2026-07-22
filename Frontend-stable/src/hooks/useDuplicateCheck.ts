import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/lib/aiStore";
import type { StatusLaporan } from "@/types/laporan";

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number | null,
  lng2: number | null,
): number | null {
  if (lat2 === null || lng2 === null) return null;
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(Math.min(a, 1)), Math.sqrt(1 - Math.min(a, 1)));
}

export interface ActiveReport {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  status: StatusLaporan | string;
  created_at: string;
}

export type AddEvidenceState = "idle" | "loading" | "success" | "error";

export interface UseActiveReportCheckReturn {
  checking: boolean;
  activeReport: ActiveReport | null;
  nearestDistance: number | null;
  addEvidenceState: AddEvidenceState;
  addEvidenceMessage: string;
  evidenceLimitReached: boolean;
  submitEvidence: (
    reportId: string,
    file: File,
    reporterName: string,
    options?: {
      isBatch?: boolean;
      catatan?: string;
      kerusakanPanjang?: string;
      kerusakanLebar?: string;
    },
  ) => Promise<void>;
  reset: () => void;
}

const REQUEST_TIMEOUT_MS = 10_000;

const DEDUP_ENABLED = import.meta.env.VITE_DEDUP_ENABLED !== "false";

export function useDuplicateCheck(
  lat: number | null,
  lng: number | null,
  district: string,
  roadName: string,
  isGpsActive: boolean,
  fileHash?: string | null,
): UseActiveReportCheckReturn {
  const [checking, setChecking] = useState(false);
  const [activeReport, setActiveReport] = useState<ActiveReport | null>(null);

  const [addEvidenceState, setAddEvidenceState] = useState<AddEvidenceState>("idle");
  const [addEvidenceMessage, setAddEvidenceMessage] = useState("");
  const [evidenceLimitReached, setEvidenceLimitReached] = useState(false);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callCheck = useCallback(
    async (params: {
      lat?: number;
      lng?: number;
      district?: string;
      roadName?: string;
      fileHash?: string;
    }) => {
      if (!DEDUP_ENABLED) {
        setChecking(false);
        return;
      }
      console.log("[DuplicateCheck] callCheck dipanggil dengan params:", JSON.stringify(params));
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      setChecking(true);

      try {
        const base = API_BASE_URL.startsWith("http")
          ? API_BASE_URL
          : `${window.location.origin}${API_BASE_URL}`;
        const url = new URL(`${base}/v1/reports/check-duplicate`);
        console.log("[DuplicateCheck] URL:", url.toString());
        if (params.lat !== undefined && params.lng !== undefined) {
          url.searchParams.set("latitude", params.lat.toString());
          url.searchParams.set("longitude", params.lng.toString());
        }
        if (params.district) url.searchParams.set("district", params.district);
        if (params.roadName) url.searchParams.set("road_name", params.roadName.trim());
        if (params.fileHash) url.searchParams.set("file_hash", params.fileHash);

        console.log("[DuplicateCheck] Fetching:", url.toString());
        const res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);
        console.log("[DuplicateCheck] Response status:", res.status);
        if (!res.ok) {
          setActiveReport(null);
          setChecking(false);
          return;
        }
        const data = await res.json();
        console.log("[DuplicateCheck] Response data:", JSON.stringify(data));
        setActiveReport(data.report ?? null);

        if (params.lat !== undefined && params.lng !== undefined && data.nearest_distance_meters != null) {
          const reportCode = data.report?.report_code ?? "-";
          console.log(
            `[DuplicateCheck] ${reportCode} — ${data.nearest_distance_meters} meter (dari server)`,
          );
          setNearestDistance(Number(data.nearest_distance_meters));
        } else if (data.report && params.lat !== undefined && params.lng !== undefined) {
          const dist = haversineDistance(
            params.lat, params.lng,
            data.report.latitude, data.report.longitude,
          );
          if (dist !== null) {
            console.log(
              `[DuplicateCheck] Laporan terdekat: ${data.report.report_code} — ${dist.toFixed(1)} meter (frontend)`,
            );
            setNearestDistance(dist);
          }
        } else {
          setNearestDistance(null);
        }
        setChecking(false);
      } catch (e) {
        console.log("[DuplicateCheck] ERROR:", e);
        clearTimeout(timeoutId);
        setActiveReport(null);
        setChecking(false);
      }
    },
    [],
  );

  useEffect(() => {
    console.log("[DuplicateCheck] useEffect GPS:", { isGpsActive, lat, lng });
    if (isGpsActive && lat !== null && lng !== null) {
      callCheck({
        lat,
        lng,
        district: district || undefined,
        roadName: roadName || undefined,
        fileHash: fileHash || undefined,
      });
    }
  }, [isGpsActive, lat, lng]);

  useEffect(() => {
    console.log("[DuplicateCheck] useEffect fileHash:", { fileHash });
    if (fileHash) {
      callCheck({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        district: district || undefined,
        roadName: roadName || undefined,
        fileHash,
      });
    }
  }, [fileHash]);

  useEffect(() => {
    console.log("[DuplicateCheck] useEffect district:", { district });
    if (!district) return;
    callCheck({
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      district,
      roadName: roadName || undefined,
      fileHash: fileHash || undefined,
    });
  }, [district]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (isGpsActive) return;
    if (!district) return;
    debounceTimerRef.current = setTimeout(() => {
      callCheck({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        district,
        roadName: roadName || undefined,
        fileHash: fileHash || undefined,
      });
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [roadName]);

  const submitEvidence = useCallback(
    async (
      reportId: string,
      file: File,
      reporterName: string,
      options?: {
        isBatch?: boolean;
        catatan?: string;
        kerusakanPanjang?: string;
        kerusakanLebar?: string;
      },
    ) => {
      if (!DEDUP_ENABLED) {
        setAddEvidenceState("error");
        setAddEvidenceMessage("Fitur bukti laporan dinonaktifkan.");
        return;
      }
      setAddEvidenceState("loading");
      setAddEvidenceMessage("");

      try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("reporter_name", reporterName);
        if (options?.isBatch) fd.append("is_batch", "1");
        if (options?.catatan) fd.append("catatan", options.catatan);
        if (options?.kerusakanPanjang) fd.append("kerusakan_panjang", options.kerusakanPanjang);
        if (options?.kerusakanLebar) fd.append("kerusakan_lebar", options.kerusakanLebar);

        const token = localStorage.getItem("auth_token") ?? localStorage.getItem("jalankita_token");
        const response = await fetch(`${API_BASE_URL}/v1/reports/${reportId}/add-evidence`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });

        const data = await response.json();

        if (!response.ok) {
          const msg =
            data.error_code === "DUPLICATE_IMAGE"
              ? "Foto ini sudah pernah dikirim sebelumnya."
              : data.error_code === "INVALID_STATUS"
                ? data.message
                : data.error_code === "MAX_EVIDENCE_REACHED"
                  ? data.message
                  : (data.message ?? "Gagal mengirim bukti foto.");
          if (data.error_code === "MAX_EVIDENCE_REACHED") {
            setEvidenceLimitReached(true);
          }
          setAddEvidenceState("error");
          setAddEvidenceMessage(msg);
          return;
        }

        setAddEvidenceState("success");
        setAddEvidenceMessage(
          `Foto bukti berhasil ditambahkan ke laporan ${data.data?.report?.report_code ?? ""}.`,
        );
      } catch {
        setAddEvidenceState("error");
        setAddEvidenceMessage("Tidak dapat terhubung ke server. Silakan coba lagi.");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setChecking(false);
    setActiveReport(null);
    setAddEvidenceState("idle");
    setAddEvidenceMessage("");
    setEvidenceLimitReached(false);
    setNearestDistance(null);
  }, []);

  return {
    checking,
    activeReport,
    nearestDistance,
    addEvidenceState,
    addEvidenceMessage,
    evidenceLimitReached,
    submitEvidence,
    reset,
  };
}
