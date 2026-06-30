import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/reports")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

const SEVERITY_CLASSES: Record<string, string> = {
  "Rusak Berat": "bg-[#E11D48] text-white",
  "Rusak Sedang": "bg-orange-50 text-[#F97316] border border-orange-200",
  "Rusak Ringan": "bg-amber-50 text-[#F59E0B] border border-amber-200",
};

const STATUS_CLASSES: Record<string, string> = {
  Selesai: "bg-[#10B981] text-white",
  "Sedang Diperbaiki": "bg-orange-50 text-[#F97316] border border-orange-200",
  Disetujui: "bg-blue-50 text-[#2563EB] border border-blue-200",
  Ditolak: "bg-[#E11D48] text-white",
  "Menunggu Review": "bg-amber-50 text-[#F59E0B] border border-amber-200",
};

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminReports />
    </AdminLayout>
  );
}

function AdminReports() {
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [uptdFilter, setUptdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [actionMenuReportId, setActionMenuReportId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{
    id: string;
    code: string;
    current: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuReportId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/admin/reports/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      setConfirmDeleteId(null);
    },
  });

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (statusFilter) params.set("status", statusFilter);
  if (uptdFilter) params.set("uptd_id", uptdFilter);
  params.set("page", String(page));
  params.set("limit", "20");

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", search, statusFilter, uptdFilter, page],
    queryFn: () =>
      apiFetch(`/api/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    placeholderData: (prev: unknown) => prev as typeof reportsQuery.data,
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams-dropdown"],
    queryFn: () =>
      apiFetch("/api/teams?limit=100", { headers: { Authorization: `Bearer ${token}` } }).then(
        (r) => r.json(),
      ),
  });

  const resp = reportsQuery.data as
    | {
        success?: boolean;
        data?: {
          id: string;
          report_code: string;
          reporter_name: string;
          road_name: string;
          district: string;
          overall_severity: string;
          status: string;
          assigned_team_name: string | null;
          created_at: string;
        }[];
        total?: number;
        page?: number;
        last_page?: number;
      }
    | undefined;

  const reports = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const lastPage = resp?.last_page ?? 1;
  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);

  const teams: { id: number; name: string }[] = teamsQuery.data?.data ?? [];

  function handleFilterChange() {
    if (page !== 1) setPage(1);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Semua Laporan</h1>
        <p className="text-[13px] text-[#64748B] mt-1">
          Lihat dan kelola seluruh laporan kerusakan jalan
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              placeholder="Cari kode, jalan, atau pelapor..."
              className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              handleFilterChange();
            }}
            className="h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]"
          >
            <option value="">Semua Status</option>
            <option value="Menunggu Review">Menunggu Review</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Sedang Diperbaiki">Sedang Diperbaiki</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditolak">Ditolak</option>
          </select>
          <select
            value={uptdFilter}
            onChange={(e) => {
              setUptdFilter(e.target.value);
              handleFilterChange();
            }}
            className="h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]"
          >
            <option value="">Semua Tim Satgas</option>
            <option value="0">Belum Assign</option>
            {teams.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          {reportsQuery.isPending ? (
            <div className="p-8 text-center text-[#64748B]">Memuat data...</div>
          ) : reportsQuery.isError ? (
            <div className="p-8 text-center text-[#E11D48]">Gagal memuat data.</div>
          ) : (
            <>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kode</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Ruas Jalan</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kecamatan</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Severity</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Tim Satgas</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#475569]">Tanggal</th>
                    <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#64748B]">
                        Tidak ada laporan.
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
                      >
                        <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#0F172A]">
                          {r.report_code}
                        </td>
                        <td className="py-3 px-4 text-[#0F172A]">{r.road_name}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r.district}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${SEVERITY_CLASSES[r.overall_severity] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}
                          >
                            {r.overall_severity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_CLASSES[r.status] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">{r.assigned_team_name ?? "—"}</td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {r.created_at ? r.created_at.slice(0, 10) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to="/detail-report"
                              search={{ reportId: r.id }}
                              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569] inline-block"
                              title="Lihat Detail"
                            >
                              <Icon name="open_in_new" className="!text-[18px]" />
                            </Link>
                            <button
                              onClick={() =>
                                setActionMenuReportId(actionMenuReportId === r.id ? null : r.id)
                              }
                              className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"
                              title="Aksi"
                            >
                              <Icon name="more_vert" className="!text-[18px]" />
                            </button>
                          </div>
                          {actionMenuReportId === r.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-2 top-10 z-50 w-44 bg-white rounded-xl border border-[#E2E8F0] shadow-xl py-1 text-[13px]"
                            >
                              <button
                                onClick={() => {
                                  setActionMenuReportId(null);
                                  navigate({ to: "/edit-report", search: { reportId: r.id } });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[#0F172A] hover:bg-[#F8FAFC] text-left"
                              >
                                <Icon name="edit" className="!text-[16px] text-[#64748B]" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setActionMenuReportId(null);
                                  setStatusModal({
                                    id: r.id,
                                    code: r.report_code,
                                    current: r.status,
                                  });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[#0F172A] hover:bg-[#F8FAFC] text-left"
                              >
                                <Icon name="swap_horiz" className="!text-[16px] text-[#64748B]" />
                                Ubah Status
                              </button>
                              <hr className="my-1 border-[#E2E8F0]" />
                              <button
                                onClick={() => {
                                  setActionMenuReportId(null);
                                  setConfirmDeleteId(r.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[#E11D48] hover:bg-[#FFF1F2] text-left"
                              >
                                <Icon name="delete" className="!text-[16px]" />
                                Hapus
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {total > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                  <span className="text-[12px] text-[#64748B]">
                    {from}–{to} dari {total}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <button
                      disabled={page >= lastPage}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus Laporan"
        message={`Yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus"
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
        confirmLoading={deleteMutation.isPending}
      />

      {statusModal && (
        <StatusChangeModal
          id={statusModal.id}
          code={statusModal.code}
          current={statusModal.current}
          token={token}
          loading={statusLoading}
          onLoading={setStatusLoading}
          onClose={() => {
            setStatusModal(null);
            if (!statusLoading) qc.invalidateQueries({ queryKey: ["admin-reports"] });
          }}
          onDone={() => {
            setStatusModal(null);
            qc.invalidateQueries({ queryKey: ["admin-reports"] });
          }}
        />
      )}
    </div>
  );
}

const ALL_STATUSES = ["Menunggu Review", "Disetujui", "Ditolak", "Sedang Diperbaiki", "Selesai"];

function StatusChangeModal({
  id,
  code,
  current,
  token,
  loading,
  onLoading,
  onClose,
  onDone,
}: {
  id: string;
  code: string;
  current: string;
  token: string;
  loading: boolean;
  onLoading: (v: boolean) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    if (!selected || selected === current) return;
    onLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/reports/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: selected }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.message ?? "Gagal mengubah status.");
        onLoading(false);
        return;
      }
      onDone();
    } catch {
      setError("Terjadi kesalahan jaringan.");
      onLoading(false);
    }
  }

  return (
    <ModalBase
      onClose={onClose}
      icon="swap_horiz"
      badge="UBAH STATUS"
      title="Ubah Status Laporan"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || loading}
            className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0F3A6A] disabled:opacity-40 transition-all flex items-center justify-center gap-1"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Simpan"
            )}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#64748B] mb-1">
        {code} — Status saat ini: <span className="font-semibold text-[#0F172A]">{current}</span>
      </p>
      <div className="flex flex-col gap-2">
        {ALL_STATUSES.filter((s) => s !== current).map((s) => (
          <label
            key={s}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${selected === s ? "border-[#1A4F8A] bg-[#F0F4FF]" : "border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}
          >
            <input
              type="radio"
              name="status"
              value={s}
              checked={selected === s}
              onChange={(e) => setSelected(e.target.value)}
              className="accent-[#1A4F8A]"
            />
            <span className="text-[13px] font-medium text-[#0F172A]">{s}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-[12px] text-[#E11D48]">{error}</p>}
    </ModalBase>
  );
}
