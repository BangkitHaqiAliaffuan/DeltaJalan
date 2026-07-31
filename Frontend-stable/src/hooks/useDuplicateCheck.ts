import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

export type PhotoClass = "valid" | "spatial_dup" | "hash_dup";

export interface PhotoResult {
  index: number;
  class: PhotoClass;
  report: ActiveReport | null;
  distance: number | null;
}

export interface DuplicateSummary {
  duplicate_count: number;
  valid_count: number;
  all_duplicates: boolean;
}

const EMPTY_SUMMARY: DuplicateSummary = {
  duplicate_count: 0,
  valid_count: 0,
  all_duplicates: false,
};

const EVIDENCE_ALLOWED_STATUSES = ["Menunggu Review"];

export type AddEvidenceState = "idle" | "loading" | "success" | "error";

export interface UseActiveReportCheckReturn {
  checking: boolean;
  activeReport: ActiveReport | null;
  nearestDistance: number | null;
  photoResults: PhotoResult[];
  summary: DuplicateSummary;
  evidenceTarget: ActiveReport | null;
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
  submitEvidenceBatch: (
    reportId: string,
    files: File[],
    reporterName: string,
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
  fileHashes?: (string | null)[],
  photoCoords?: ({ lat: number | null; lng: number | null } | null)[],
): UseActiveReportCheckReturn {
  const [checking, setChecking] = useState(false);
  const [activeReport, setActiveReport] = useState<ActiveReport | null>(null);
  const [photoResults, setPhotoResults] = useState<PhotoResult[]>([]);
  const [summary, setSummary] = useState<DuplicateSummary>(EMPTY_SUMMARY);

  const [addEvidenceState, setAddEvidenceState] = useState<AddEvidenceState>("idle");
  const [addEvidenceMessage, setAddEvidenceMessage] = useState("");
  const [evidenceLimitReached, setEvidenceLimitReached] = useState(false);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photosRef = useRef<{ hash: string | null; lat: number | null; lng: number | null }[]>([]);

  useEffect(() => {
    photosRef.current = (fileHashes ?? []).map((hash, i) => ({
      hash: hash ?? null,
      lat: photoCoords?.[i]?.lat ?? null,
      lng: photoCoords?.[i]?.lng ?? null,
    }));
  }, [fileHashes, photoCoords]);

  const callCheck = useCallback(
    async (params: {
      lat?: number;
      lng?: number;
      district?: string;
      roadName?: string;
      fileHash?: string;
      photos?: { hash: string | null; lat: number | null; lng: number | null }[];
    }) => {
      if (!DEDUP_ENABLED) {
        setChecking(false);
        return;
      }
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

        const hasPhotos = params.photos !== undefined && params.photos.length > 0;
        let data: any;

        if (hasPhotos) {
          const res = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photos: params.photos,
              latitude: params.lat,
              longitude: params.lng,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!res.ok) {
            setActiveReport(null);
            setChecking(false);
            return;
          }
          data = await res.json();
        } else {
          if (params.lat !== undefined && params.lng !== undefined) {
            url.searchParams.set("latitude", params.lat.toString());
            url.searchParams.set("longitude", params.lng.toString());
          }
          if (params.district) url.searchParams.set("district", params.district);
          if (params.roadName) url.searchParams.set("road_name", params.roadName.trim());
          if (params.fileHash) url.searchParams.set("file_hash", params.fileHash);

          const res = await fetch(url.toString(), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            setActiveReport(null);
            setChecking(false);
            return;
          }
          data = await res.json();
        }

        setActiveReport(data.report ?? null);
        setEvidenceLimitReached(false);
        if (hasPhotos) {
          setPhotoResults(data.results ?? []);
          setSummary(data.summary ?? EMPTY_SUMMARY);
        } else {
          setPhotoResults([]);
          setSummary(EMPTY_SUMMARY);
        }

        const firstDup = (data.results ?? []).find(
          (r: PhotoResult) => r.class !== "valid",
        );
        if (firstDup?.distance != null) {
          setNearestDistance(Number(firstDup.distance));
        } else if (
          data.nearest_distance_meters != null &&
          params.lat !== undefined &&
          params.lng !== undefined
        ) {
          setNearestDistance(Number(data.nearest_distance_meters));
        } else if (data.report && params.lat !== undefined && params.lng !== undefined) {
          const dist = haversineDistance(
            params.lat, params.lng,
            data.report.latitude, data.report.longitude,
          );
          setNearestDistance(dist);
        } else {
          setNearestDistance(null);
        }
        setChecking(false);
      } catch (e) {
        clearTimeout(timeoutId);
        setActiveReport(null);
        setPhotoResults([]);
        setSummary(EMPTY_SUMMARY);
        setNearestDistance(null);
        setChecking(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isGpsActive && lat !== null && lng !== null) {
      callCheck({
        lat,
        lng,
        district: district || undefined,
        roadName: roadName || undefined,
        fileHash: fileHashes?.[0] ?? undefined,
        photos: photosRef.current,
      });
    }
  }, [isGpsActive, lat, lng]);

  useEffect(() => {
    if (!fileHashes || fileHashes.length === 0) return;
    callCheck({
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      district: district || undefined,
      roadName: roadName || undefined,
      photos: photosRef.current,
    });
  }, [fileHashes, photoCoords]);

  useEffect(() => {
    if (!district) return;
    callCheck({
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      district,
      roadName: roadName || undefined,
      fileHash: fileHashes?.[0] ?? undefined,
      photos: photosRef.current,
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
        fileHash: fileHashes?.[0] ?? undefined,
        photos: photosRef.current,
      });
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [roadName]);

  const evidenceTarget = useMemo<ActiveReport | null>(() => {
    if (photoResults.length === 0) {
      return activeReport &&
        EVIDENCE_ALLOWED_STATUSES.includes(String(activeReport.status))
        ? activeReport
        : null;
    }
    const dups = photoResults.filter((r) => r.class !== "valid");
    if (dups.length === 1 && photoResults.length - dups.length >= 1) {
      return null;
    }
    const spatialDup = photoResults.find(
      (r) =>
        r.class === "spatial_dup" &&
        r.report !== null &&
        EVIDENCE_ALLOWED_STATUSES.includes(String(r.report.status)),
    );
    return spatialDup?.report ?? null;
  }, [photoResults, activeReport]);

  const sendEvidenceFile = useCallback(
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
    ): Promise<{ ok: boolean; stop: boolean; message: string; reportCode?: string }> => {
      if (!DEDUP_ENABLED) {
        return {
          ok: false,
          stop: true,
          message: "Fitur bukti laporan dinonaktifkan.",
        };
      }

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
          const stop = data.error_code === "MAX_EVIDENCE_REACHED";
          if (stop) {
            setEvidenceLimitReached(true);
          }

          return { ok: false, stop, message: msg };
        }

        return {
          ok: true,
          stop: false,
          message: "Foto bukti berhasil ditambahkan.",
          reportCode: data.data?.report?.report_code ?? "",
        };
      } catch {
        return {
          ok: false,
          stop: true,
          message: "Tidak dapat terhubung ke server. Silakan coba lagi.",
        };
      }
    },
    [],
  );

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
      setAddEvidenceState("loading");
      setAddEvidenceMessage("");
      const result = await sendEvidenceFile(reportId, file, reporterName, options);
      setAddEvidenceState(result.ok ? "success" : "error");
      setAddEvidenceMessage(
        result.ok
          ? `Foto bukti berhasil ditambahkan ke laporan ${result.reportCode ?? ""}.`
          : result.message,
      );
    },
    [sendEvidenceFile],
  );

  const submitEvidenceBatch = useCallback(
    async (reportId: string, files: File[], reporterName: string) => {
      if (files.length === 0) return;
      setAddEvidenceState("loading");
      setAddEvidenceMessage("");

      let successCount = 0;
      let reportCode: string | undefined;
      let finalMessage = "";
      let stop = false;

      for (const file of files) {
        if (stop) break;
        const result = await sendEvidenceFile(reportId, file, reporterName, { isBatch: true });
        if (result.stop) {
          stop = true;
        }
        if (result.ok) {
          successCount += 1;
          reportCode = result.reportCode ?? reportCode;
        } else {
          finalMessage = result.message;
        }
      }

      if (successCount > 0) {
        setAddEvidenceState("success");
        setAddEvidenceMessage(
          `${successCount} foto bukti berhasil ditambahkan ke laporan ${reportCode ?? ""}.`,
        );
      } else {
        setAddEvidenceState("error");
        setAddEvidenceMessage(finalMessage || "Gagal mengirim bukti foto.");
      }
    },
    [sendEvidenceFile],
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setChecking(false);
    setActiveReport(null);
    setPhotoResults([]);
    setSummary(EMPTY_SUMMARY);
    setAddEvidenceState("idle");
    setAddEvidenceMessage("");
    setEvidenceLimitReached(false);
    setNearestDistance(null);
  }, []);

  return {
    checking,
    activeReport,
    nearestDistance,
    photoResults,
    summary,
    evidenceTarget,
    addEvidenceState,
    addEvidenceMessage,
    evidenceLimitReached,
    submitEvidence,
    submitEvidenceBatch,
    reset,
  };
}
