import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/export")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminExport />
    </AdminLayout>
  );
}

function AdminExport() {
  const token = getToken() ?? "";
  const [month, setMonth] = useState("01");
  const [year, setYear] = useState("2026");
  const [dlBusy, setDlBusy] = useState<string | null>(null);

  useEffect(() => {
    const n = new Date();
    setMonth(String(n.getMonth() + 1).padStart(2, "0"));
    setYear(String(n.getFullYear()));
  }, []);

  const statsQuery = useQuery({
    queryKey: ["admin-export-stats", month, year],
    queryFn: () =>
      apiFetch(`/api/reports/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
        r.json(),
      ),
  });

  const stats = statsQuery.data as
    | {
        data?: {
          total: number;
          selesai: number;
          sedang_diperbaiki: number;
          rusak_berat: number;
          rusak_sedang: number;
          rusak_ringan: number;
        };
      }
    | undefined;

  const d = stats?.data;

  async function doDownload(format: "excel" | "pdf") {
    const m = parseInt(month, 10);
    setDlBusy(format);
    const url = `/api/reports/export/monthly-${format}?month=${m}&year=${year}`;

    try {
      const res = await apiFetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `Gagal mengunduh (${res.status})`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if ((window as Record<string, unknown>).Capacitor?.isNativePlatform?.() === true) {
        window.open(blobUrl, "_system");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `rekap-bulanan-${year}-${month}.${format === "excel" ? "xlsx" : "pdf"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunduh file.");
    }
    setDlBusy(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Export Laporan</h1>
        <p className="text-[13px] text-[#64748B] mt-1">
          Download laporan bulanan dalam format Excel atau PDF
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Export Bulanan</h2>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[#475569] block mb-1">Bulan</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]"
              >
                {BULAN.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, "0")}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[#475569] block mb-1">Tahun</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => doDownload("excel")}
              disabled={dlBusy !== null}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-[13px] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Icon name="table_chart" className="text-emerald-600 !text-[20px]" />
                <span className="font-medium text-[#0F172A]">Export Excel (.xlsx)</span>
              </span>
              <Icon name="download" className="text-[#64748B] !text-[18px]" />
            </button>
            <button
              onClick={() => doDownload("pdf")}
              disabled={dlBusy !== null}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-[13px] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Icon name="picture_as_pdf" className="text-red-600 !text-[20px]" />
                <span className="font-medium text-[#0F172A]">Export PDF</span>
              </span>
              <Icon name="download" className="text-[#64748B] !text-[18px]" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Preview Ringkasan</h2>
          {statsQuery.isPending ? (
            <div className="text-[13px] text-[#64748B]">Memuat data...</div>
          ) : (
            <div className="space-y-3 text-[13px]">
              {(d
                ? [
                    { label: "Total Laporan", value: (d.total ?? 0).toLocaleString() },
                    { label: "Selesai", value: (d.selesai ?? 0).toLocaleString() },
                    { label: "Dalam Proses", value: (d.sedang_diperbaiki ?? 0).toLocaleString() },
                    { label: "Rusak Berat", value: (d.rusak_berat ?? 0).toLocaleString() },
                    { label: "Rusak Sedang", value: (d.rusak_sedang ?? 0).toLocaleString() },
                    { label: "Rusak Ringan", value: (d.rusak_ringan ?? 0).toLocaleString() },
                  ]
                : []
              ).map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-[#64748B]">{item.label}</span>
                  <span className="font-semibold text-[#0F172A]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
