/**
 * useDuplicateCheck
 *
 * Custom hook untuk fitur Anti-Duplikasi Laporan (report-duplicate-check).
 *
 * Fitur:
 * 1. Pencarian spasial — laporan aktif dalam radius 15m dari GPS petugas
 * 2. Pencarian tekstual — laporan aktif berdasarkan kecamatan + nama jalan (debounce 300ms)
 * 3. AbortController — batalkan request lama jika ada request baru
 * 4. Timeout 10 detik — jika API tidak merespons, tampilkan state kosong
 * 5. Non-blocking — kegagalan pengecekan tidak memblokir submit laporan
 *
 * Requirement 6.6: Diimplementasikan sebagai custom hook yang dapat diimpor
 * ke upload.tsx dengan minimal perubahan pada kode yang sudah ada.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/lib/aiStore";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DuplicateReport {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  support_count: number;
  created_at: string;
  distance_meters?: number; // hanya ada di spatial duplicates
}

export interface DuplicateCheckResult {
  spatial_duplicates: DuplicateReport[];
  textual_duplicates: DuplicateReport[];
  image_duplicates: DuplicateReport[];
}

export type DuplicateCheckState =
  | "idle" // belum ada trigger
  | "loading" // sedang memanggil API
  | "done" // selesai, ada atau tidak ada hasil
  | "error"; // error (tidak ditampilkan ke user, non-blocking)

export type AddEvidenceState = "idle" | "loading" | "success" | "error";

export interface UseDuplicateCheckReturn {
  /** State pengecekan duplikasi */
  checkState: DuplicateCheckState;
  /** Hasil pengecekan: laporan duplikat spasial dan tekstual */
  result: DuplicateCheckResult;
  /** Apakah ada duplikat (spatial atau textual) */
  hasDuplicates: boolean;
  /** State pengiriman bukti foto */
  addEvidenceState: AddEvidenceState;
  /** ID laporan yang sedang diproses untuk add-evidence */
  addEvidenceTargetId: string | null;
  /** Pesan sukses/error dari add-evidence */
  addEvidenceMessage: string;
  /** Kirim foto bukti ke laporan yang sudah ada */
  submitEvidence: (reportId: string, file: File, reporterName: string) => Promise<void>;
  /** Reset semua state (dipanggil saat foto dihapus) */
  reset: () => void;
}

// ── Konstanta ──────────────────────────────────────────────────────────────

/** Minimum karakter nama jalan sebelum trigger pencarian */
const MIN_ROAD_NAME_LENGTH = 3;

/** Debounce delay untuk input nama jalan (ms) */
const DEBOUNCE_MS = 300;

/** Timeout request ke CheckDuplicateAPI (ms) */
const REQUEST_TIMEOUT_MS = 10_000;

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDuplicateCheck(
  /** Koordinat GPS dari useLocationFromPhoto */
  lat: number | null,
  lng: number | null,
  /** Nilai kecamatan dari form */
  district: string,
  /** Nilai nama jalan dari form */
  roadName: string,
  /** Apakah GPS sedang aktif (status === 'success') */
  isGpsActive: boolean,
  /** SHA-256 hash konten file foto (untuk cek duplikasi gambar) */
  fileHash?: string | null,
): UseDuplicateCheckReturn {
  const [checkState, setCheckState] = useState<DuplicateCheckState>("idle");
  const [result, setResult] = useState<DuplicateCheckResult>({
    spatial_duplicates: [],
    textual_duplicates: [],
    image_duplicates: [],
  });
  const [addEvidenceState, setAddEvidenceState] = useState<AddEvidenceState>("idle");
  const [addEvidenceTargetId, setAddEvidenceTargetId] = useState<string | null>(null);
  const [addEvidenceMessage, setAddEvidenceMessage] = useState("");

  // AbortController untuk membatalkan request yang sedang berjalan
  const abortControllerRef = useRef<AbortController | null>(null);
  // Debounce timer untuk input nama jalan
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core: Panggil CheckDuplicateAPI ───────────────────────────────────

  const callCheckDuplicate = useCallback(
    async (params: {
      lat?: number;
      lng?: number;
      district?: string;
      roadName?: string;
      fileHash?: string;
    }) => {
      const hasCoords = params.lat !== undefined && params.lng !== undefined;
      const hasDistrict = params.district && params.district.trim().length > 0;
      const hasRoadName = params.roadName && params.roadName.trim().length >= MIN_ROAD_NAME_LENGTH;
      const hasFileHash = params.fileHash && params.fileHash.trim().length > 0;

      if (!hasCoords && !hasDistrict && !hasRoadName && !hasFileHash) {
        return;
      }

      // Batalkan request sebelumnya jika masih berjalan
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Timeout 10 detik
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      setCheckState("loading");

      try {
        const url = new URL(`${window.location.origin}${API_BASE_URL}/v1/reports/check-duplicate`);

        if (hasCoords) {
          url.searchParams.set("latitude", params.lat!.toString());
          url.searchParams.set("longitude", params.lng!.toString());
        }
        if (hasDistrict) {
          url.searchParams.set("district", params.district!);
        }
        if (params.roadName && params.roadName.trim().length > 0) {
          url.searchParams.set("road_name", params.roadName.trim());
        }
        if (hasFileHash) {
          url.searchParams.set("file_hash", params.fileHash!);
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          setResult({ spatial_duplicates: [], textual_duplicates: [], image_duplicates: [] });
          setCheckState("done");
          return;
        }

        const data: DuplicateCheckResult = await response.json();
        setResult({
          spatial_duplicates: data.spatial_duplicates ?? [],
          textual_duplicates: data.textual_duplicates ?? [],
          image_duplicates: data.image_duplicates ?? [],
        });
        setCheckState("done");
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setResult({ spatial_duplicates: [], textual_duplicates: [], image_duplicates: [] });
        setCheckState("done");
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Effect: Trigger saat GPS berhasil ─────────────────────────────────
  // Requirement 2.1: Saat GPS berhasil, langsung panggil API dengan koordinat

  useEffect(() => {
    if (isGpsActive && lat !== null && lng !== null) {
      callCheckDuplicate({
        lat,
        lng,
        district: district || undefined,
        roadName: roadName || undefined,
        fileHash: fileHash || undefined,
      });
    }
  }, [isGpsActive, lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect: Trigger saat kecamatan berubah ────────────────────────────
  // Requirement 3.1: Saat kecamatan dipilih, panggil API

  // ── Effect: Trigger saat fileHash berubah ───────────────────────────
  // Cek duplikasi gambar berdasarkan SHA-256 hash

  useEffect(() => {
    if (fileHash) {
      callCheckDuplicate({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        district: district || undefined,
        roadName: roadName || undefined,
        fileHash,
      });
    }
  }, [fileHash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!district) return;

    if (!lat && !lng && !roadName && !fileHash) return;

    callCheckDuplicate({
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      district,
      roadName: roadName || undefined,
      fileHash: fileHash || undefined,
    });
  }, [district]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect: Debounce saat nama jalan berubah ──────────────────────────
  // Requirement 3.2: Debounce 300ms pada input nama jalan

  useEffect(() => {
    // Bersihkan timer sebelumnya
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Jika GPS aktif, nama jalan diisi otomatis — tidak perlu debounce manual
    if (isGpsActive) return;

    // Jika tidak ada district, tidak ada yang bisa dicari
    if (!district) return;

    debounceTimerRef.current = setTimeout(() => {
      callCheckDuplicate({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        district,
        roadName: roadName || undefined,
        fileHash: fileHash || undefined,
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [roadName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add Evidence ──────────────────────────────────────────────────────
  // Requirement 4.6: Kirim foto bukti ke laporan yang sudah ada

  const submitEvidence = useCallback(async (reportId: string, file: File, reporterName: string) => {
    setAddEvidenceState("loading");
    setAddEvidenceTargetId(reportId);
    setAddEvidenceMessage("");

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("reporter_name", reporterName);

      // Ambil token dari localStorage (Sanctum)
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
            : (data.message ?? "Gagal mengirim bukti foto.");
        setAddEvidenceState("error");
        setAddEvidenceMessage(msg);
        return;
      }

      setAddEvidenceState("success");
      setAddEvidenceMessage(
        `Foto bukti berhasil ditambahkan ke laporan ${data.data?.report?.report_code ?? ""}. Terima kasih!`,
      );

      // Update support_count di result lokal
      setResult((prev) => {
        const updateCount = (list: DuplicateReport[]) =>
          list.map((r) =>
            r.id === reportId
              ? { ...r, support_count: data.data?.report?.support_count ?? r.support_count + 1 }
              : r,
          );
        return {
          spatial_duplicates: updateCount(prev.spatial_duplicates),
          textual_duplicates: updateCount(prev.textual_duplicates),
          image_duplicates: updateCount(prev.image_duplicates),
        };
      });
    } catch {
      setAddEvidenceState("error");
      setAddEvidenceMessage("Tidak dapat terhubung ke server. Silakan coba lagi.");
    }
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────
  // Requirement 6.5: Reset saat foto dihapus

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setCheckState("idle");
    setResult({ spatial_duplicates: [], textual_duplicates: [], image_duplicates: [] });
    setAddEvidenceState("idle");
    setAddEvidenceTargetId(null);
    setAddEvidenceMessage("");
  }, []);

  const hasDuplicates =
    result.spatial_duplicates.length > 0 ||
    result.textual_duplicates.length > 0 ||
    result.image_duplicates.length > 0;

  return {
    checkState,
    result,
    hasDuplicates,
    addEvidenceState,
    addEvidenceTargetId,
    addEvidenceMessage,
    submitEvidence,
    reset,
  };
}
