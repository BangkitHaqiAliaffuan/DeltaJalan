import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TopBar } from "@/components/jk/TopBar";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Beranda Petugas — JalanKita" }] }),
});

function HomePage() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
        <TopBar showBrand />
        <main className="pb-24 md:pb-8">
          <section className="px-4 pt-6 pb-8 bg-[#E8F0FA] rounded-b-xl border-b border-border-subtle mb-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                Selamat pagi, Agus Setiawan
              </h2>
              <div className="flex items-center gap-1 text-on-surface-variant">
                <Icon name="location_on" className="!text-[16px]" />
                <p className="font-body-md text-body-md">Petugas Lapangan · Kec. Sidoarjo</p>
              </div>
            </div>
          </section>

          <section className="px-4 mb-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { v: 47, l: "Total Laporan", icon: "assignment", color: "text-primary" },
                { v: 12, l: "Rusak Berat", icon: "report_problem", color: "text-rusak-berat" },
                { v: 8, l: "Diproses", icon: "sync", color: "text-rusak-sedang" },
                { v: 27, l: "Selesai", icon: "check_circle", color: "text-selesai" },
              ].map((m) => (
                <div
                  key={m.l}
                  className="bg-surface-container-lowest border border-border-subtle p-4 rounded-xl shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon name={m.icon} className={m.color} />
                  </div>
                  <p className={`font-headline-md text-headline-md font-bold ${m.color} mb-1`}>
                    {m.v}
                  </p>
                  <p className="font-label-md text-label-md text-on-surface-variant">{m.l}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-4 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Tugas Hari Ini
              </h3>
              <Link to="/my-reports" className="font-label-md text-label-md text-primary font-bold">
                Lihat Semua
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              <Link
                to="/ai-result"
                className="bg-surface-container-lowest border-l-4 border-l-rusak-berat border border-border-subtle p-4 rounded-xl flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-label-sm text-label-sm text-rusak-berat font-bold">
                    RUSAK BERAT
                  </p>
                  <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Inspeksi Jl. Jenggolo No.5
                  </h4>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Sidoarjo Tengah · 09:00 WIB
                  </p>
                </div>
                <Icon name="chevron_right" className="text-outline" />
              </Link>
              <Link
                to="/review"
                search={{}}
                className="bg-surface-container-lowest border-l-4 border-l-rusak-sedang border border-border-subtle p-4 rounded-xl flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-label-sm text-label-sm text-rusak-sedang font-bold">
                    RUSAK SEDANG
                  </p>
                  <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Cek Jl. Pahlawan No.23
                  </h4>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Sidoarjo Kota · 13:30 WIB
                  </p>
                </div>
                <Icon name="chevron_right" className="text-outline" />
              </Link>
            </div>
          </section>

          <section className="px-4 mb-8">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-4">
              Laporan Terbaru
            </h3>
            <div className="flex flex-col divide-y divide-border-subtle bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              {[
                {
                  id: "LP-2024-001",
                  t: "Lubang Jalan Sedalam 15cm",
                  sev: "Rusak Berat",
                  color: "bg-error-container text-error",
                },
                {
                  id: "LP-2024-006",
                  t: "Retakan Aspal Panjang 3m",
                  sev: "Rusak Sedang",
                  color: "bg-orange-100 text-rusak-sedang border border-rusak-sedang/20",
                },
              ].map((r) => (
                <Link
                  to="/review"
                  search={{}}
                  key={r.id}
                  className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                      <Icon name="description" className="text-primary" />
                    </div>
                    <div>
                      <p className="font-id-code text-id-code text-on-surface-variant mb-[2px]">
                        {r.id}
                      </p>
                      <h4 className="font-label-md text-label-md font-bold text-on-surface mb-1">
                        {r.t}
                      </h4>
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-bold ${r.color}`}
                      >
                        {r.sev}
                      </div>
                    </div>
                  </div>
                  <Icon name="chevron_right" className="text-outline" />
                </Link>
              ))}
            </div>
          </section>
        </main>
        <BottomNav />
      </div>
    </AppLayout>
  );
}
