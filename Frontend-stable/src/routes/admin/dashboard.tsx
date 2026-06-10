import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getCurrentUser } from "@/lib/auth";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/admin/dashboard")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Dashboard Admin — DeltaJalan" }] }),
});

function RouteComponent() {
  return <AdminLayout><AdminDashboard /></AdminLayout>;
}

const MOCK_STATS = {
  total_reports: 2847,
  active_users: 42,
  total_upr: 4,
  compliance_rate: 78,
  bulan_ini: 312,
  selesai_bulan_ini: 198,
};

const MOCK_MONTHLY = [
  { bulan: "Jan", total: 210, selesai: 145, rusak_berat: 48 },
  { bulan: "Feb", total: 245, selesai: 168, rusak_berat: 52 },
  { bulan: "Mar", total: 280, selesai: 195, rusak_berat: 61 },
  { bulan: "Apr", total: 265, selesai: 178, rusak_berat: 55 },
  { bulan: "Mei", total: 298, selesai: 210, rusak_berat: 63 },
  { bulan: "Jun", total: 312, selesai: 198, rusak_berat: 58 },
];

const MOCK_UPR = [
  { name: "Satgas Wilayah Utara", total: 420, dalam_proses: 12, selesai: 380, kepatuhan: 85 },
  { name: "Satgas Wilayah Selatan", total: 380, dalam_proses: 8, selesai: 345, kepatuhan: 72 },
  { name: "Satgas Wilayah Barat", total: 310, dalam_proses: 15, selesai: 275, kepatuhan: 68 },
  { name: "Satgas Wilayah Timur", total: 290, dalam_proses: 6, selesai: 265, kepatuhan: 90 },
];

function getGreeting(client: boolean): string {
  if (!client) return "Selamat Pagi";
  const h = new Date().getHours();
  if (h < 12) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function formatTanggal(client: boolean): string {
  if (!client) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function AdminDashboard() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const user = getCurrentUser();
  const maxTotal = Math.max(...MOCK_MONTHLY.map((m) => m.total));

  return (
    <div>
      <section className="-m-4 md:-m-6 mb-6 px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0]">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-[#0F172A]">
          {getGreeting(isClient)}, {user?.name ?? "Admin"}
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <Icon name="location_on" className="!text-[16px] text-[#475569]" />
          <p className="font-body-md text-body-md text-[#475569]">
            Admin &middot; {formatTanggal(isClient)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Laporan", value: MOCK_STATS.total_reports.toLocaleString(), subtitle: "Terlapor", icon: "description", color: "text-[#1e40af]" },
          { label: "Selesai", value: MOCK_STATS.selesai_bulan_ini.toString(), subtitle: "Bulan Ini", icon: "check_circle", color: "text-[#10B981]" },
          { label: "User Aktif", value: MOCK_STATS.active_users.toString(), subtitle: "Seluruh Role", icon: "people", color: "text-[#F97316]" },
          { label: "Kepatuhan", value: `${MOCK_STATS.compliance_rate}%`, subtitle: "Rata-rata Deadline", icon: "verified", color: "text-[#8B5CF6]" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-[#E2E8F0] rounded-xl p-4"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider" style={{ color: card.color.replace("text-[", "").replace("]", "") }}>
                {card.label}
              </span>
              <Icon name={card.icon} className={`${card.color} !text-[20px]`} filled />
            </div>
            <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
              {card.value}
            </p>
            <p className="font-label-sm text-label-sm text-[#475569]">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div
          className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-4"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">Tren Laporan 6 Bulan</h2>
          <div className="flex items-end gap-2" style={{ height: "180px" }}>
            {MOCK_MONTHLY.map((m) => {
              const hSelesai = (m.selesai / maxTotal) * 100;
              const hProses = ((m.total - m.selesai - m.rusak_berat) / maxTotal) * 100;
              const hBerat = (m.rusak_berat / maxTotal) * 100;
              return (
                <div key={m.bulan} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex flex-col items-center justify-end rounded-t" style={{ height: `${hSelesai + hProses + hBerat}%`, minHeight: 4 }}>
                    <div className="w-full bg-[#E11D48] rounded-t" style={{ height: `${hBerat}%`, minHeight: hBerat > 0 ? 4 : 0 }} title={`Rusak Berat: ${m.rusak_berat}`} />
                    <div className="w-full bg-[#F59E0B]" style={{ height: `${hProses}%`, minHeight: hProses > 0 ? 4 : 0 }} />
                    <div className="w-full bg-[#10B981]" style={{ height: `${hSelesai}%`, minHeight: hSelesai > 0 ? 4 : 0 }} />
                  </div>
                  <span className="font-label-sm text-label-sm text-[#64748B]">{m.bulan}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E2E8F0]">
            {[
              { color: "bg-[#10B981]", label: "Selesai" },
              { color: "bg-[#F59E0B]", label: "Dalam Proses" },
              { color: "bg-[#E11D48]", label: "Rusak Berat" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-label-sm text-label-sm text-[#475569]">
                <span className={`w-2.5 h-2.5 rounded ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="bg-white border border-[#E2E8F0] rounded-xl p-4"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">Ringkasan</h2>
          <div className="space-y-4">
            <div>
              <p className="font-label-sm text-label-sm text-[#64748B] mb-1">Bulan Ini</p>
              <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">{MOCK_STATS.bulan_ini}</p>
              <p className="font-label-sm text-label-sm text-[#10B981] font-semibold">{MOCK_STATS.selesai_bulan_ini} selesai diperbaiki</p>
            </div>
            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="font-label-sm text-label-sm text-[#64748B] mb-3">Kepatuhan Deadline per Prioritas</p>
              {[
                { label: "Tinggi", value: 72, bar: "bg-red-500" },
                { label: "Sedang", value: 81, bar: "bg-orange-500" },
                { label: "Rendah", value: 89, bar: "bg-emerald-500" },
              ].map((p) => (
                <div key={p.label} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label-sm text-label-sm text-[#475569]">{p.label}</span>
                    <span className="font-label-sm text-label-sm text-[#0F172A] font-semibold">{p.value}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p.bar} transition-all`} style={{ width: `${p.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="bg-white border border-[#E2E8F0] rounded-xl"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">Kinerja Tim UPR</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Tim</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Diproses</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Selesai</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Kepatuhan</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_UPR.map((upr) => (
                <tr key={upr.name} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-body-sm text-body-sm font-semibold text-[#0F172A]">{upr.name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#0F172A] font-medium">{upr.total.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#F97316] font-medium">{upr.dalam_proses}</td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#10B981] font-medium">{upr.selesai}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold ${
                      upr.kepatuhan >= 80
                        ? "bg-emerald-50 text-[#10B981] border border-emerald-200"
                        : upr.kepatuhan >= 70
                        ? "bg-amber-50 text-[#F59E0B] border border-amber-200"
                        : "bg-red-50 text-[#E11D48] border border-red-200"
                    }`}>
                      {upr.kepatuhan}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
