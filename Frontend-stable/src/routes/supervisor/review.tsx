import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { Portal } from "@/components/jk/Portal";
import { ReviewDrawer } from "@/components/jk/ReviewDrawer";
import { ModalBase } from "@/components/jk/ModalBase";
import { SafeImage } from "@/components/jk/SafeImage";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser, getToken } from "@/lib/auth";
import { resolveImageUrl } from "@/lib/imageUrl";

import { pciBgColor } from "@/lib/pci";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/supervisor/review")({
  component: SupervisorReview,
  head: () => ({ meta: [{ title: "Review Laporan — DeltaJalan" }] }),
});

function SupervisorReview() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user?.role !== "supervisor") {
      navigate({ to: "/masuk" });
    }
  }, [user, navigate]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionMsgType, setActionMsgType] = useState<"success" | "error">("success");
  const [successModal, setSuccessModal] = useState({ open: false, message: "" });

  // Filters
  const [filterSource, setFilterSource] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [sortBy, setSortBy] = useState("pci_score");

  const queryParams = new URLSearchParams();
  queryParams.set("status", "menunggu_review");
  queryParams.set("sort_by", sortBy);
  queryParams.set("limit", "50");
  if (filterSource) queryParams.set("source", filterSource);
  if (filterSeverity) queryParams.set("severity", filterSeverity);

  // Fetch queue list
  const {
    data: queueResponse,
    isFetching: queueLoading,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ["review-queue", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/reports?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        items: (json.data ?? []) as Laporan[],
        total: json.total as number,
      };
    },
    enabled: !!token,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const reports = queueResponse?.items ?? [];
  const totalReports = queueResponse?.total ?? 0;

  // Reset selected index if out of bounds
  useEffect(() => {
    if (selectedIndex >= reports.length && reports.length > 0) {
      setSelectedIndex(0);
    }
  }, [reports.length, selectedIndex, setSelectedIndex]);

  // Fetch detail for selected report
  const selectedId = reports[selectedIndex]?.id;
  const { data: selectedDetail, isPending: detailLoading } = useQuery({
    queryKey: ["review-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await fetch(`${API_BASE_URL}/reports/${selectedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.data ?? null) as Laporan | null;
    },
    enabled: !!selectedId && !!token,
    staleTime: 10_000,
  });

  function showMsg(msg: string, type: "success" | "error" = "success") {
    setActionMsg(msg);
    setActionMsgType(type);
    setTimeout(() => setActionMsg(""), 4000);
  }

  async function handleAction(
    url: string,
    method: string,
    body?: unknown,
    type?: "approve" | "reject",
  ) {
    const setLoading = type === "reject" ? setRejectLoading : setApproveLoading;
    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (res.ok) {
        await refetchQueue();
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        setSuccessModal({ open: true, message: json.message ?? "Berhasil." });
      } else {
        showMsg(json.message ?? "Gagal.", "error");
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = () => {
    const report = selectedDetail ?? reports[selectedIndex];
    if (!report) return;
    const isWargaTelegram = report.source && ["warga", "telegram"].includes(report.source);
    const endpoint = isWargaTelegram
      ? `${API_BASE_URL}/reports/${report.id}/approve-and-assign`
      : `${API_BASE_URL}/reports/${report.id}/approve`;
    handleAction(endpoint, "POST", undefined, "approve");
  };

  const handleReject = (alasan: string, catatan?: string) => {
    const report = selectedDetail ?? reports[selectedIndex];
    if (!report) return;
    handleAction(
      `${API_BASE_URL}/reports/${report.id}/tolak`,
      "POST",
      { alasan, catatan },
      "reject",
    );
  };

  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  function selectReport(index: number) {
    setSelectedIndex(index);
    setShowMobileDrawer(true);
  }

  // Close mobile drawer when queue becomes empty after action
  useEffect(() => {
    if (reports.length === 0) setShowMobileDrawer(false);
  }, [reports.length, setShowMobileDrawer]);

  return (
    <PageLayout title="Review Laporan" withBottomNav fullPage>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Queue List */}
        <div className="w-full md:w-[35%] md:min-w-[320px] flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-[#D0DAE8]">
          {/* Filters */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#D0DAE8] bg-white shrink-0">
            <select
              value={filterSource}
              onChange={(e) => {
                setFilterSource(e.target.value);
                setSelectedIndex(0);
              }}
              className="text-[11px] px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
            >
              <option value="">Semua Sumber</option>
              <option value="warga">Warga</option>
              <option value="petugas">Petugas</option>
              <option value="telegram">Telegram</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setSelectedIndex(0);
              }}
              className="text-[11px] px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
            >
              <option value="">Semua Severity</option>
              <option value="Rusak Berat">Rusak Berat</option>
              <option value="Rusak Sedang">Rusak Sedang</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Baik">Baik</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-[11px] px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
            >
              <option value="pci_score">PCI (Kritis)</option>
              <option value="deadline_review">Deadline</option>
              <option value="created_at">Terbaru</option>
              <option value="priority">Prioritas</option>
            </select>
          </div>

          {/* Action message */}
          {actionMsg && (
            <div
              className={`mx-3 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium ${
                actionMsgType === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {actionMsg}
            </div>
          )}

          {/* List header */}
          <div className="flex items-center justify-between px-4 py-2 shrink-0">
            <h3 className="text-[13px] font-bold text-[#0F172A]">Perlu Review</h3>
            <span className="text-[11px] font-semibold text-[#476788] tabular-nums">
              {reports.length} laporan
            </span>
          </div>

          {/* Queue items */}
          <div className="flex-1 overflow-y-auto">
            {queueLoading && reports.length === 0 ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-lg bg-[#D0DAE8] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-[#D0DAE8] rounded" />
                      <div className="h-3 w-1/2 bg-[#D0DAE8] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <Icon name="check_circle" className="!text-5xl text-[#10B981] mb-3" />
                <p className="text-[15px] font-bold text-[#0F172A] mb-1">Semua Sudah Direview</p>
                <p className="text-[12px] text-[#476788]">
                  Tidak ada laporan yang perlu direview saat ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {reports.map((r, idx) => {
                  const isSelected = idx === selectedIndex;
                  const isOverdue = r.terlambat_review || r.status_deadline === "terlambat";
                  const thumbUrl = resolveImageUrl(r.first_photo_url);
                  const deadlineTime = r.deadline_review
                    ? new Date(r.deadline_review).getTime()
                    : null;
                  const isUrgent =
                    deadlineTime &&
                    deadlineTime - Date.now() < 4 * 60 * 60 * 1000 &&
                    deadlineTime > Date.now();

                  return (
                    <button
                      key={r.id}
                      onClick={() => selectReport(idx)}
                      className={`w-full text-left px-3 py-2.5 flex gap-3 transition-colors cursor-pointer hover:bg-[#F8FAFC] ${
                        isSelected
                          ? "bg-[#DBE4FF] border-l-2 border-[#1e40af]"
                          : "border-l-2 border-transparent"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg bg-[#E8F0FA] overflow-hidden shrink-0 mt-0.5">
                        {thumbUrl ? (
                          <SafeImage src={thumbUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="photo" className="!text-lg text-[#C4D4E6]" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isOverdue
                                ? "bg-[#E11D48] animate-pulse"
                                : isUrgent
                                  ? "bg-[#F59E0B]"
                                  : "bg-[#10B981]"
                            }`}
                          />
                          <span className="text-[12px] font-bold text-[#0F172A] truncate">
                            {r.road_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#476788]">
                          <span className="font-mono">{r.report_code}</span>
                          {r.pci_score != null && (
                            <>
                              <span>·</span>
                              <span
                                className={`px-1 py-0.5 rounded text-[9px] font-bold ${pciBgColor(r.pci_score)}`}
                              >
                                PCI {r.pci_score}
                              </span>
                            </>
                          )}
                          {r.source && r.source !== "petugas" && (
                            <>
                              <span>·</span>
                              <span
                                className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                                  r.source === "warga"
                                    ? "bg-purple-50 text-[#7C3AED] border border-purple-200"
                                    : "bg-sky-50 text-[#0284C7] border border-sky-200"
                                }`}
                              >
                                {r.source === "warga" ? "W" : "T"}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                          {isOverdue && (
                            <span className="text-[#E11D48] font-semibold">Terlambat!</span>
                          )}
                          {isUrgent && !isOverdue && (
                            <span className="text-[#F59E0B] font-semibold">Mendesak</span>
                          )}
                          {r.deadline_review && !isOverdue && !isUrgent && (
                            <span className="text-[#476788]">
                              {(() => {
                                const h = Math.round(
                                  (new Date(r.deadline_review).getTime() - Date.now()) /
                                    (1000 * 60 * 60),
                                );
                                return h < 1 ? "< 1 jam" : `${h} jam`;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* AI status dot */}
                      <div
                        className="shrink-0 self-center"
                        title={r.ai_severity ? "AI: Siap" : "AI: Belum"}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            r.ai_severity ? "bg-[#10B981]" : "bg-[#94A3B8]"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop: back link */}
          <div className="hidden md:block px-3 py-2 border-t border-[#D0DAE8] shrink-0">
            <Link
              to="/supervisor"
              className="flex items-center gap-1 text-[11px] font-semibold text-[#476788] hover:text-[#1e40af] transition-colors"
            >
              <Icon name="arrow_back" className="!text-[14px]" />
              Kembali ke Dashboard
            </Link>
          </div>
        </div>

        {/* Drawer - Desktop side panel */}
        <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
          <ReviewDrawer
            report={selectedDetail ?? null}
            loading={detailLoading}
            currentIndex={selectedIndex}
            totalCount={reports.length}
            onApprove={handleApprove}
            onReject={handleReject}
            onNext={() => setSelectedIndex((i) => Math.min(i + 1, reports.length - 1))}
            onPrev={() => setSelectedIndex((i) => Math.max(i - 1, 0))}
            onClose={() => {}}
            onDetail={() =>
              navigate({ to: "/detail-report", search: { reportId: reports[selectedIndex]?.id } })
            }
            approveLoading={approveLoading}
            rejectLoading={rejectLoading}
          />
        </div>
      </div>

      {/* Drawer - Mobile overlay */}
      {showMobileDrawer && reports[selectedIndex] && (
        <Portal>
          <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <ReviewDrawer
              report={selectedDetail ?? null}
              loading={detailLoading}
              currentIndex={selectedIndex}
              totalCount={reports.length}
              onApprove={handleApprove}
              onReject={handleReject}
              onNext={() => setSelectedIndex((i) => Math.min(i + 1, reports.length - 1))}
              onPrev={() => setSelectedIndex((i) => Math.max(i - 1, 0))}
              onClose={() => setShowMobileDrawer(false)}
              onDetail={() => {
                setShowMobileDrawer(false);
                navigate({
                  to: "/detail-report",
                  search: { reportId: reports[selectedIndex]?.id },
                });
              }}
              approveLoading={approveLoading}
              rejectLoading={rejectLoading}
            />
          </div>
        </Portal>
      )}

      {/* Success modal */}
      {successModal.open && (
        <ModalBase
          onClose={() => setSuccessModal({ open: false, message: "" })}
          icon="check_circle"
          badge="BERHASIL"
          title="Laporan Disetujui"
          footer={
            <button
              onClick={() => setSuccessModal({ open: false, message: "" })}
              className="w-full py-2.5 rounded-xl bg-[#1e40af] text-white text-[14px] font-bold hover:bg-[#1e3a8a] transition-colors cursor-pointer"
            >
              Lanjut ke Laporan Berikutnya
            </button>
          }
        >
          <p className="text-[14px] text-[#0F172A] leading-relaxed">{successModal.message}</p>
        </ModalBase>
      )}
    </PageLayout>
  );
}

export default SupervisorReview;
