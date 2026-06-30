import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/config")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminConfig />
    </AdminLayout>
  );
}

function AdminConfig() {
  const qc = useQueryClient();
  const token = getToken() ?? "";
  const [deadlineReview, setDeadlineReview] = useState("48");
  const [deadlineResolusi, setDeadlineResolusi] = useState("168");
  const [warningHours, setWarningHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () =>
      apiFetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
        r.json(),
      ),
  });

  const data = settingsQuery.data as
    | {
        success?: boolean;
        data?: { key: string; value: string; type: string; description: string }[];
      }
    | undefined;

  useEffect(() => {
    const s = data?.data;
    if (!s) return;
    const dr = s.find((x) => x.key === "deadline_review")?.value;
    const dres = s.find((x) => x.key === "deadline_resolusi")?.value;
    const wh = s.find((x) => x.key === "warning_hours")?.value;
    if (dr) setDeadlineReview(dr);
    if (dres) setDeadlineResolusi(dres);
    if (wh) setWarningHours(wh);
  }, [data]);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          settings: {
            deadline_review: deadlineReview,
            deadline_resolusi: deadlineResolusi,
            warning_hours: warningHours,
          },
        }),
      });
      const r = await res.json();
      if (r.success) {
        setMsg("Pengaturan berhasil disimpan.");
        qc.invalidateQueries({ queryKey: ["admin-settings"] });
      } else setMsg(r.message ?? "Gagal menyimpan.");
    } catch {
      setMsg("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Pengaturan Sistem</h1>
        <p className="text-[13px] text-[#64748B] mt-1">
          Konfigurasi parameter dan threshold sistem
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Deadline & Threshold</h2>
          {msg && (
            <div
              className={`mb-4 text-[13px] px-4 py-2 rounded-lg ${msg.includes("berhasil") ? "bg-emerald-50 text-[#10B981] border border-emerald-200" : "bg-red-50 text-[#E11D48] border border-red-200"}`}
            >
              {msg}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">
                Batas Waktu Review (jam)
              </label>
              <input
                type="number"
                value={deadlineReview}
                onChange={(e) => setDeadlineReview(e.target.value)}
                className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">Default: 48 jam (2 hari)</p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">
                Batas Waktu Resolusi (jam)
              </label>
              <input
                type="number"
                value={deadlineResolusi}
                onChange={(e) => setDeadlineResolusi(e.target.value)}
                className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">Default: 168 jam (7 hari)</p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">
                Peringatan Mendekati Deadline (jam sebelum)
              </label>
              <input
                type="number"
                value={warningHours}
                onChange={(e) => setWarningHours(e.target.value)}
                className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Simpan Pengaturan
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Informasi Sistem</h2>
          <div className="space-y-3 text-[13px]">
            {[
              { label: "Versi Aplikasi", value: "2.0.0" },
              { label: "Framework", value: "React + Laravel" },
              { label: "Database", value: "PostgreSQL" },
              { label: "Jumlah Pengaturan", value: data?.data?.length?.toString() ?? "..." },
            ].map((d) => (
              <div key={d.label} className="flex justify-between py-1">
                <span className="text-[#64748B]">{d.label}</span>
                <span className="font-medium text-[#0F172A]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
