import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { formatDateRelative, getStatusBadge } from "@/lib/format";
import { sanitizeUrls, resolveImageUrl } from "@/lib/imageUrl";

export const Route = createFileRoute("/warga/laporan/$id")({
  component: WargaLaporanDetailPage,
  head: () => ({ meta: [{ title: "Detail Laporan — DeltaJalan" }] }),
});

interface TimelineItem {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
  user_id: number | null;
}

function WargaLaporanDetailPage() {
  const { id } = useParams({ from: "/warga/laporan/$id" });
  const token = getToken() ?? "";
  const [report, setReport] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/warga/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setReport(sanitizeUrls(json.data.report));
        setTimeline(json.data.timeline ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Detail Laporan</h1>
        </section>
        <div className="max-w-xl mx-auto px-4 mt-6 animate-pulse space-y-4">
          <div className="h-6 w-48 bg-[#D0DAE8] rounded" />
          <div className="h-4 w-32 bg-[#E8F0FA] rounded" />
          <div className="h-40 bg-[#E8F0FA] rounded-lg" />
          <div className="h-20 w-full bg-[#E8F0FA] rounded" />
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="pb-4 text-center py-12 text-[#476788]">
        <Icon name="error" className="!text-5xl mb-3 opacity-30" />
        <p>Laporan tidak ditemukan.</p>
        <Link to="/warga/laporan" className="text-[#1e40af] font-semibold text-sm mt-2 inline-block">
          Kembali ke daftar
        </Link>
      </main>
    );
  }

  const statusInfo = getStatusBadge(report.status);
  const photo = report.photos?.[0];

  return (
    <main className="pb-4">
      <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Detail Laporan</h1>
            <p className="font-mono text-sm text-blue-200 mt-1">{report.report_code}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-4 mt-6">
        {photo?.image_original_url && (
          <div className="mb-4 rounded-lg overflow-hidden border border-[#D0DAE8]">
            <img src={resolveImageUrl(photo.image_original_url) ?? ""} alt="Foto kerusakan" className="w-full object-cover max-h-64" />
          </div>
        )}

        <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mb-4 space-y-3">
          <div>
            <p className="text-xs text-[#476788] font-medium">Nama Jalan</p>
            <p className="font-label-md text-label-md font-semibold text-[#0F172A]">{report.road_name}</p>
          </div>
          <div>
            <p className="text-xs text-[#476788] font-medium">Kecamatan</p>
            <p className="font-body-md text-body-md text-[#0F172A]">{report.district}</p>
          </div>
          {report.description && (
            <div>
              <p className="text-xs text-[#476788] font-medium">Deskripsi</p>
              <p className="font-body-sm text-body-sm text-[#0F172A]">{report.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-[#476788] font-medium">Tanggal Laporan</p>
            <p className="font-body-sm text-body-sm text-[#0F172A]">{new Date(report.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>

        <div className="mb-4">
          <Link
            to="/lacak"
            search={{ report_code: report.report_code }}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e40af] text-[#1e40af] rounded-lg font-label-sm text-label-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            <Icon name="search" className="!text-[18px]" />
            Lacak Laporan
          </Link>
        </div>

        <div className="bg-white border border-[#D0DAE8] rounded-lg p-4">
          <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <Icon name="timeline" className="!text-lg text-[#1e40af]" />
            Riwayat Status
          </h3>

          {timeline.length === 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#1e40af] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{statusInfo.label}</p>
                <p className="text-xs text-[#476788]">{formatDateRelative(report.created_at, true)}</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {timeline.map((item, i) => {
                const isLast = i === timeline.length - 1;
                const statusLabel = getStatusBadge(item.new_status).label;
                const dateStr = new Date(item.created_at).toLocaleDateString("id-ID", {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                });

                return (
                  <div key={i} className="flex gap-3 pb-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${isLast ? "bg-[#1e40af]" : "bg-[#c4c5d5]"} shrink-0 mt-1`} />
                      {!isLast && <div className="w-px flex-1 bg-[#D0DAE8] mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">{item.notes ?? statusLabel}</p>
                      {item.notes && statusLabel !== item.notes && (
                        <p className="text-xs text-[#476788]">{statusLabel}</p>
                      )}
                      <p className="text-xs text-[#476788] mt-0.5">{dateStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
