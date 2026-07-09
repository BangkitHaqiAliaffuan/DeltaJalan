import { useState, useEffect } from "react";
import { ModalBase } from "./ModalBase";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";

interface EstimasiModalProps {
  open: boolean;
  report: { id: string; overall_severity?: string | null; report_code?: string; road_name?: string } | null;
  loading?: boolean;
  onConfirm: (targetId: string, estimasiHari: number | null) => Promise<void>;
  onClose: () => void;
}

export function EstimasiModal({ open, report, loading, onConfirm, onClose }: EstimasiModalProps) {
  const [estimasiHari, setEstimasiHari] = useState(7);
  const [estimasiMode, setEstimasiMode] = useState<"same-day" | "multi-day">("same-day");
  const [showMulaiConfirm, setShowMulaiConfirm] = useState(false);

  useEffect(() => {
    if (open && report) {
      const isRingan = report.overall_severity === "Rusak Ringan";
      setEstimasiHari(isRingan ? 1 : 7);
      setEstimasiMode(isRingan ? "same-day" : "multi-day");
      setShowMulaiConfirm(false);
    }
  }, [open, report]);

  if (!open || !report) return null;

  return (
    <>
      <ModalBase
        onClose={onClose}
        icon="play_arrow"
        badge="MULAI PENGERJAAN"
        title="Estimasi Waktu Penyelesaian"
        footer={
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowMulaiConfirm(true)}
              className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                "Memproses…"
              ) : (
                <>
                  <Icon name="play_arrow" className="!text-[18px]" />
                  Mulai Pengerjaan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
            >
              Batal
            </button>
          </>
        }
      >
        <div>
          <p className="text-[13px] text-[#475569] mb-4 leading-relaxed">
            Perkirakan waktu yang dibutuhkan untuk menyelesaikan perbaikan laporan ini.
          </p>
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                estimasiMode === "same-day"
                  ? "border-[#1A4F8A] bg-[#EFF6FF]"
                  : "border-[#D0DAE8] bg-white"
              }`}
            >
              <input
                type="radio"
                name="estimasi"
                checked={estimasiMode === "same-day"}
                onChange={() => setEstimasiMode("same-day")}
                className="accent-[#1A4F8A]"
              />
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">Same day</p>
                <p className="text-[11px] text-[#64748B]">Selesai hari ini juga</p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                estimasiMode === "multi-day"
                  ? "border-[#1A4F8A] bg-[#EFF6FF]"
                  : "border-[#D0DAE8] bg-white"
              }`}
            >
              <input
                type="radio"
                name="estimasi"
                checked={estimasiMode === "multi-day"}
                onChange={() => setEstimasiMode("multi-day")}
                className="accent-[#1A4F8A]"
              />
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">Estimasi hari</p>
                <p className="text-[11px] text-[#64748B]">Butuh beberapa hari pengerjaan</p>
              </div>
            </label>
            {estimasiMode === "multi-day" && (
              <div className="pl-8">
                <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
                  Berapa hari?
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={estimasiHari}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") { setEstimasiHari(1); return; }
                    const num = parseInt(raw, 10);
                    if (!isNaN(num)) setEstimasiHari(Math.max(1, Math.min(90, num)));
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A] appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                />
              </div>
            )}
          </div>
        </div>
      </ModalBase>

      <ConfirmDialog
        open={showMulaiConfirm}
        title="Mulai Pengerjaan?"
        message={`Mulai perbaikan ${report.report_code ?? report.id} — ${report.road_name ?? ""}?${
          estimasiMode === "same-day"
            ? "\nEstimasi: Selesai hari ini"
            : `\nEstimasi: ${estimasiHari} hari`
        }`}
        confirmText="Ya, Mulai"
        cancelText="Batal"
        confirmLoading={loading}
        onConfirm={async () => {
          setShowMulaiConfirm(false);
          await onConfirm(report.id, estimasiMode === "same-day" ? null : estimasiHari);
        }}
        onCancel={() => { setShowMulaiConfirm(false); }}
        icon="play_arrow"
        confirmClassName="flex-1 px-4 py-2.5 text-[13px] font-bold text-white bg-[#1A4F8A] rounded-xl hover:bg-[#153d6e] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
      />
    </>
  );
}
