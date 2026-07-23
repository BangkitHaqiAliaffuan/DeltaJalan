import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PciCard } from "@/components/jk/PciCard";
import { pciColor, pciConditionLabel, pciDotColor } from "@/lib/pci";
import { apiFetch } from "@/lib/api";
import "./admin.css";

export const Route = createFileRoute("/admin/pci")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
  head: () => ({ meta: [{ title: "PCI Dashboard — DeltaJalan" }] }),
});

interface DistrictPci {
  district: string;
  total: number;
  avg_pci: number;
  min_pci: number;
  max_pci: number;
  kritis: number;
}

interface KabupatenData {
  total_laporan: number;
  avg_pci: number;
  kritis: number;
}

interface KritisReport {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  latitude: string;
  longitude: string;
  pci_score: number;
  overall_severity: string;
  status: string;
  created_at: string;
  source: string;
}

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminPciDashboard />
    </AdminLayout>
  );
}

function AdminPciDashboard() {
  const token = getToken() ?? "";
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const overviewQuery = useQuery({
    queryKey: ["admin-pci-overview"],
    queryFn: () =>
      apiFetch("/api/pci/overview", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    refetchInterval: 120_000,
  });

  const kritisQuery = useQuery({
    queryKey: ["admin-pci-kritis"],
    queryFn: () =>
      apiFetch("/api/pci/kritis?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    refetchInterval: 120_000,
  });

  const overviewData = overviewQuery.data?.data as
    | { districts: DistrictPci[]; kabupaten: KabupatenData }
    | undefined;
  const kritisData = kritisQuery.data?.data as KritisReport[] | undefined;
  const kab = overviewData?.kabupaten;
  const districts = overviewData?.districts ?? [];

  const isLoading = overviewQuery.isPending || kritisQuery.isPending;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">PCI Dashboard</h1>
        <p className="text-[13px] text-[#64748B] mt-1">
          Indeks Kondisi Jalan (Pavement Condition Index) Kab. Sidoarjo
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <div className="h-4 w-24 bg-[#E2E8F0] rounded animate-pulse mb-2" />
              <div className="h-8 w-20 bg-[#E2E8F0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : kab ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PciCard score={kab.avg_pci} />
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Icon name="warning" className="!text-[20px] text-red-600" />
              </div>
              <div>
                <p className="text-[12px] text-[#64748B]">Laporan Kritis (PCI &le; 40)</p>
                <p className="text-[22px] font-bold text-[#E11D48]">
                  {kab.kritis.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Icon name="description" className="!text-[20px] text-[#1A4F8A]" />
              </div>
              <div>
                <p className="text-[12px] text-[#64748B]">Total Laporan dengan PCI</p>
                <p className="text-[22px] font-bold text-[#0F172A]">
                  {kab.total_laporan.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-[#E2E8F0] rounded-xl mb-6">
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Per Kecamatan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kecamatan</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Rata-rata PCI</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Min</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Max</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Total</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Kritis</th>
              </tr>
            </thead>
            <tbody>
              {districts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    Belum ada data PCI per kecamatan.
                  </td>
                </tr>
              ) : (
                districts.map((d) => (
                  <tr
                    key={d.district}
                    className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
                  >
                    <td className="py-3 px-4 text-[#0F172A] font-medium">{d.district}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[13px] font-semibold" style={{ color: pciColor(d.avg_pci) }}>
                        {Number(d.avg_pci).toFixed(1)}
                      </span>
                      <span className="ml-1.5 text-[11px] text-[#64748B]">
                        ({pciConditionLabel(d.avg_pci)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[#64748B]">{Number(d.min_pci).toFixed(1)}</td>
                    <td className="py-3 px-4 text-right text-[#64748B]">{Number(d.max_pci).toFixed(1)}</td>
                    <td className="py-3 px-4 text-right text-[#0F172A]">{d.total}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${d.kritis > 0 ? "bg-red-50 text-red-700" : "text-[#64748B]"}`}>
                        {d.kritis}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl">
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Laporan Kritis (PCI &le; 40)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kode</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Ruas Jalan</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kecamatan</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">PCI</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {!kritisData || kritisData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    Tidak ada laporan kritis.
                  </td>
                </tr>
              ) : (
                kritisData.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
                  >
                    <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#0F172A]">
                      {r.report_code}
                    </td>
                    <td className="py-3 px-4 text-[#0F172A]">{r.road_name}</td>
                    <td className="py-3 px-4 text-[#64748B]">{r.district}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[13px] font-bold" style={{ color: pciColor(r.pci_score) }}>
                        {Number(r.pci_score).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{r.status}</td>
                    <td className="py-3 px-4 text-right text-[#64748B]">
                      {r.created_at ? r.created_at.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
