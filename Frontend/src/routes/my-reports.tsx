import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken } from "@/lib/auth";
import type { Laporan, TrustLabel } from "@/types/laporan";

export const Route = createFileRoute("/my-reports")({
  component: MyReportsPage,
  head: () => ({ meta: [{ title: "Laporan Saya — JalanKita" }] }),
});

function MyReportsPage() {
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const token = getToken();

  useEffect(() => {
    loadLaporan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLaporan() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports?user_reports=true&limit=50`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLaporan(data.data ?? []);
      }
    } catch {
      // fallback ke data kosong
    } finally {
      setIsLoading(false);
    }
  }

  function getSeverityStyle(sev: string | null | undefined) {
    const map: Record<string, { sev: string; sevCls: string; status: string }> = {
      "Rusak Berat": {
        sev: "Rusak Berat",
        sevCls: "bg-error-container text-error border-rusak-berat/20",
        status: "Menunggu Review",
      },
      "Rusak Sedang": {
        sev: "Rusak Sedang",
        sevCls: "bg-orange-100 text-rusak-sedang border-rusak-sedang/20",
        status: "Menunggu Review",
      },
      "Rusak Ringan": {
        sev: "Rusak Ringan",
        sevCls: "bg-amber-100 text-rusak-ringan border-rusak-ringan/20",
        status: "Menunggu Review",
      },
    };
    return map[sev ?? ""] ?? { sev: sev ?? "", sevCls: "bg-surface-container-high text-on-surface-variant border-outline-variant", status: "Menunggu Review" };
  }

  const statusStyle = (status: string) => {
    const map: Record<string, string> = {
      "Diproses": "bg-secondary-container text-on-secondary-container border-secondary-container",
      "Menunggu Review": "bg-surface-variant text-on-surface-variant border-outline-variant",
      "Selesai": "bg-emerald-100 text-selesai border-selesai/20",
    };
    return map[status] ?? "bg-surface-variant text-on-surface-variant border-outline-variant";
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
      <header className="sticky top-0 z-40 flex justify-between items-center px-4 py-2 bg-surface-container-lowest border-b border-border-subtle h-[60px]">
        <div className="w-10" />
        <h1 className="font-headline-sm text-headline-sm font-semibold text-primary">Laporan Saya</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low">
          <Icon name="filter_list" className="text-on-surface-variant" />
        </button>
      </header>

      <section className="px-margin-mobile pt-md">
        <div className="relative flex items-center">
          <Icon name="search" className="absolute left-4 text-on-surface-variant" />
          <input className="w-full bg-[#F1F5F9] border-none rounded-xl h-12 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary" placeholder="Cari ID atau nama jalan..." />
        </div>
      </section>

      <section className="flex overflow-x-auto gap-2 px-margin-mobile py-md no-scrollbar">
        {["Semua", "Rusak Berat", "Rusak Sedang", "Rusak Ringan", "Diproses", "Selesai"].map((t, i) => (
          <button key={t} className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md text-label-md active:scale-95 transition-transform ${i === 0 ? "bg-primary text-on-primary" : "bg-surface-container-lowest border border-border-subtle text-on-surface-variant"}`}>{t}</button>
        ))}
      </section>

      <div className="px-margin-mobile mb-sm">
        <p className="font-label-md text-label-md text-on-surface-variant">{laporan.length} laporan Anda</p>
      </div>

      <main className="px-margin-mobile flex flex-col gap-md pb-28">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
          </div>
        ) : laporan.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <Icon name="description" className="!text-[48px] mb-2" />
            <p className="font-body-md text-body-md">Belum ada laporan.</p>
          </div>
        ) : (
          laporan.map((c) => {
            const s = getSeverityStyle(c.overall_severity ?? c.ai_severity);
            return (
              <div key={c.id} className="bg-surface-container-lowest rounded-xl border border-border-subtle p-md shadow-sm hover:border-primary-container transition-all">
                <div className="flex justify-between items-start mb-sm">
                  <span className="font-id-code text-id-code text-primary font-bold">{c.report_code}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                </div>
                <div className="flex gap-md mb-md">
                  <div className="w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0">
                    {c.image_original_url ? (
                      <img className="w-full h-full object-cover" src={c.image_original_url} alt={c.road_name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="photo" className="text-on-surface-variant" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-headline-sm text-[15px] font-bold text-on-surface leading-tight mb-1">{c.road_name}</h3>
                    <p className="font-body-md text-[13px] text-on-surface-variant">Kec. {c.district}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm border ${s.sevCls}`}>{s.sev}</span>
                  <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm border ${statusStyle(c.status)}`}>{c.status}</span>
                </div>
              </div>
            );
          })
        )}
      </main>
      <BottomNav />
      </div>
    </AppLayout>
  );
}
