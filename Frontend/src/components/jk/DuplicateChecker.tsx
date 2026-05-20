/**
 * DuplicateChecker
 *
 * Komponen UI utama untuk fitur Anti-Duplikasi Laporan.
 *
 * Menampilkan:
 * 1. MapView — peta dengan posisi petugas dan laporan terdekat
 * 2. DuplicateWarningBanner — banner kuning jika ada potensi duplikasi
 * 3. LocalReportList — daftar kartu laporan aktif di kecamatan yang dipilih
 *
 * Diintegrasikan ke upload.tsx di antara "Informasi Lokasi" dan tombol submit.
 *
 * Requirement 4, 5, 6: Integrasi ke halaman Upload
 */

import { lazy, Suspense, useState } from "react";
import { Icon } from "@/components/jk/Icon";
import type { DuplicateReport } from "@/hooks/useDuplicateCheck";
import type { DuplicateCheckState, AddEvidenceState } from "@/hooks/useDuplicateCheck";

// Lazy load MapView agar tidak memperlambat waktu muat awal halaman
// Requirement 7.5: MapView menggunakan lazy loading
const DuplicateMapView = lazy(() =>
  import("@/components/jk/DuplicateMapView").then((m) => ({
    default: m.DuplicateMapView,
  }))
);

// ── Types ──────────────────────────────────────────────────────────────────

interface DuplicateCheckerProps {
  /** Koordinat GPS petugas */
  userLat: number | null;
  userLng: number | null;
  /** Apakah GPS sedang aktif */
  isGpsActive: boolean;
  /** Apakah GPS sedang dalam proses deteksi */
  isGpsDetecting: boolean;
  /** Kecamatan yang dipilih */
  district: string;
  /** State pengecekan duplikasi */
  checkState: DuplicateCheckState;
  /** Laporan duplikat spasial */
  spatialDuplicates: DuplicateReport[];
  /** Laporan duplikat tekstual */
  textualDuplicates: DuplicateReport[];
  /** Apakah ada duplikat */
  hasDuplicates: boolean;
  /** State pengiriman bukti */
  addEvidenceState: AddEvidenceState;
  /** ID laporan target add-evidence */
  addEvidenceTargetId: string | null;
  /** Pesan add-evidence */
  addEvidenceMessage: string;
  /** File foto yang sudah dipilih petugas */
  selectedFile: File | null;
  /** Nama petugas (dari auth) */
  reporterName: string;
  /** Callback saat tombol "Dukung Laporan" diklik */
  onSupportReport: (reportId: string) => void;
  /** Apakah tombol submit utama harus disembunyikan */
  isSubmitHidden: boolean;
}

// ── Helper: Format tanggal ─────────────────────────────────────────────────

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

// ── Sub-komponen: Badge Status ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    "Menunggu Review": {
      bg: "bg-[#EFF6FF]",
      text: "text-[#1E40AF]",
      border: "border-[#93C5FD]",
    },
    "Sedang Diperbaiki": {
      bg: "bg-[#FFEDD5]",
      text: "text-[#9A3412]",
      border: "border-[#FDBA74]",
    },
    Selesai: {
      bg: "bg-[#D1FAE5]",
      text: "text-[#065F46]",
      border: "border-[#6EE7B7]",
    },
  };

  const c = config[status] ?? config["Menunggu Review"];

  return (
    <span
      className={`inline-flex items-center ${c.bg} ${c.text} border ${c.border} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}
    >
      {status}
    </span>
  );
}

// ── Sub-komponen: Kartu Laporan Duplikat ───────────────────────────────────

function DuplicateCard({
  report,
  onSupport,
  addEvidenceState,
  addEvidenceTargetId,
  addEvidenceMessage,
  hasFile,
}: {
  report: DuplicateReport;
  onSupport: (id: string) => void;
  addEvidenceState: AddEvidenceState;
  addEvidenceTargetId: string | null;
  addEvidenceMessage: string;
  hasFile: boolean;
}) {
  const isThisTarget = addEvidenceTargetId === report.id;
  const isLoading = isThisTarget && addEvidenceState === "loading";
  const isSuccess = isThisTarget && addEvidenceState === "success";
  const isError = isThisTarget && addEvidenceState === "error";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
      {/* Header kartu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-[#475569] mb-0.5">{report.report_code}</p>
          <p className="text-[13px] font-semibold text-[#0F172A] leading-snug truncate">
            {report.road_name}
          </p>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Kec. {report.district}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* Info bawah */}
      <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
        <span className="flex items-center gap-1">
          <Icon name="calendar_today" className="!text-[13px]" />
          {formatDate(report.created_at)}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="thumb_up" className="!text-[13px]" />
          {report.support_count} dukungan
        </span>
        {report.distance_meters !== undefined && (
          <span className="flex items-center gap-1 text-[#EF4444] font-medium">
            <Icon name="near_me" className="!text-[13px]" />
            {report.distance_meters}m
          </span>
        )}
      </div>

      {/* Feedback add-evidence */}
      {isSuccess && (
        <div className="flex items-start gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg px-3 py-2">
          <Icon name="check_circle" className="text-[#065F46] !text-[16px] shrink-0 mt-0.5" filled />
          <p className="text-[12px] text-[#065F46] leading-snug">{addEvidenceMessage}</p>
        </div>
      )}
      {isError && (
        <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2">
          <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#991B1B] leading-snug">{addEvidenceMessage}</p>
        </div>
      )}

      {/* Tombol Dukung Laporan */}
      {!isSuccess && (
        <button
          type="button"
          onClick={() => onSupport(report.id)}
          disabled={isLoading || !hasFile || addEvidenceState === "loading"}
          className="w-full flex items-center justify-center gap-2 bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] text-[#92400E] rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title={!hasFile ? "Pilih foto terlebih dahulu" : undefined}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#92400E]/30 border-t-[#92400E] rounded-full animate-spin" />
              Mengirim bukti...
            </>
          ) : (
            <>
              <Icon name="thumb_up" className="!text-[16px]" />
              Ini Lubang yang Sama (Dukung Laporan)
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── Komponen Utama ─────────────────────────────────────────────────────────

export function DuplicateChecker({
  userLat,
  userLng,
  isGpsActive,
  isGpsDetecting,
  district,
  checkState,
  spatialDuplicates,
  textualDuplicates,
  hasDuplicates,
  addEvidenceState,
  addEvidenceTargetId,
  addEvidenceMessage,
  selectedFile,
  reporterName,
  onSupportReport,
}: DuplicateCheckerProps) {
  const [showMap, setShowMap] = useState(true);

  // Gabungkan semua duplikat untuk ditampilkan di list
  // Hindari duplikasi jika laporan muncul di kedua list
  const allDuplicates = (() => {
    const seen = new Set<string>();
    const combined: (DuplicateReport & { _source: "spatial" | "textual" })[] = [];

    spatialDuplicates.forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push({ ...r, _source: "spatial" });
      }
    });

    textualDuplicates.forEach((r) => {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push({ ...r, _source: "textual" });
      }
    });

    return combined;
  })();

  // Jangan tampilkan apa-apa jika tidak ada foto dan GPS idle
  const hasAnyActivity =
    isGpsActive ||
    isGpsDetecting ||
    checkState !== "idle" ||
    hasDuplicates ||
    district !== "";

  if (!hasAnyActivity) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header Section ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#0F172A] flex items-center gap-1.5">
          <Icon name="search" className="!text-[18px] text-[#1A4F8A]" />
          Cek Duplikasi Laporan
        </h3>
        {checkState === "loading" && (
          <span className="flex items-center gap-1.5 text-[11px] text-[#1E40AF]">
            <span className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
            Memeriksa...
          </span>
        )}
        {checkState === "done" && hasDuplicates && (
          <span className="text-[11px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-2 py-0.5 rounded-full font-medium">
            {allDuplicates.length} laporan ditemukan
          </span>
        )}
      </div>

      {/* ── Peta Leaflet ── */}
      {/* Tampilkan peta jika GPS aktif atau ada spatial duplicates */}
      {(isGpsActive || isGpsDetecting || spatialDuplicates.length > 0) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-[#1A4F8A] font-medium self-start"
          >
            <Icon name={showMap ? "expand_less" : "expand_more"} className="!text-[16px]" />
            {showMap ? "Sembunyikan peta" : "Tampilkan peta"}
          </button>

          {showMap && (
            <Suspense
              fallback={
                <div
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center"
                  style={{ height: 220 }}
                >
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    <span className="text-[13px]">Memuat peta...</span>
                  </div>
                </div>
              }
            >
              <DuplicateMapView
                userLat={userLat}
                userLng={userLng}
                spatialDuplicates={spatialDuplicates}
                isLoading={isGpsDetecting}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* ── DuplicateWarningBanner ── */}
      {/* Requirement 4.4: Loading state banner */}
      {checkState === "loading" && (
        <div className="flex items-center gap-2.5 bg-[#EFF6FF] border border-[#93C5FD] rounded-xl px-4 py-3">
          <span className="w-4 h-4 border-2 border-[#1E40AF]/30 border-t-[#1E40AF] rounded-full animate-spin shrink-0" />
          <p className="text-[12px] text-[#1E40AF] font-medium">Memeriksa duplikasi...</p>
        </div>
      )}

      {/* Requirement 4.1: Banner peringatan jika ada duplikat */}
      {checkState === "done" && hasDuplicates && (
        <div className="flex items-start gap-2.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3">
          <Icon name="warning" className="text-[#92400E] !text-[20px] shrink-0 mt-0.5" filled />
          <p className="text-[13px] text-[#92400E] leading-relaxed">
            ⚠️ Sistem mendeteksi potensi laporan serupa di sekitar Anda. Pastikan Anda tidak
            melaporkan lubang yang sama!
          </p>
        </div>
      )}

      {/* ── LocalReportList ── */}
      {/* Requirement 3.5: Daftar kartu laporan aktif */}
      {checkState === "done" && allDuplicates.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Label jumlah laporan */}
          {district && (
            <p className="text-[12px] text-[#475569]">
              <span className="font-semibold text-[#0F172A]">{allDuplicates.length} laporan aktif</span>{" "}
              ditemukan di Kecamatan {district}
            </p>
          )}

          {/* Kartu-kartu laporan */}
          {allDuplicates.map((report) => (
            <DuplicateCard
              key={report.id}
              report={report}
              onSupport={onSupportReport}
              addEvidenceState={addEvidenceState}
              addEvidenceTargetId={addEvidenceTargetId}
              addEvidenceMessage={addEvidenceMessage}
              hasFile={selectedFile !== null}
            />
          ))}

          {/* Info jika tidak ada foto */}
          {!selectedFile && (
            <p className="text-[11px] text-[#94A3B8] text-center">
              Pilih foto terlebih dahulu untuk menggunakan tombol "Dukung Laporan"
            </p>
          )}
        </div>
      )}

      {/* State kosong setelah pengecekan */}
      {checkState === "done" && !hasDuplicates && district && (
        <div className="flex items-center gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-4 py-3">
          <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" filled />
          <p className="text-[12px] text-[#065F46]">
            Tidak ada laporan serupa ditemukan di Kecamatan {district}. Anda dapat melanjutkan.
          </p>
        </div>
      )}
    </div>
  );
}
