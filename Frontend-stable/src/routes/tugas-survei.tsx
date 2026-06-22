import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser } from "@/lib/auth";
import { useSurveyList } from "@/hooks/useSurveyQueries";
import type { SurveyTask } from "@/types/survey";

export const Route = createFileRoute("/tugas-survei")({
  component: TugasSurveiPage,
  head: () => ({ meta: [{ title: "Tugas Survei — DeltaJalan" }] }),
});

type TabKey = "semua" | "aktif" | "selesai";

function TugasSurveiPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "petugas") navigate({ to: "/" });
  }, [user, navigate]);

  const teamId = user?.team_id;
  const [activeTab, setActiveTab] = useState<TabKey>("aktif");

  const { data: tasks = [], isFetching, error } = useSurveyList(
    teamId ? { team_id: teamId } : undefined,
  );

  const tabFilter: Record<TabKey, (t: SurveyTask) => boolean> = {
    semua: () => true,
    aktif: (t) => t.status === "aktif",
    selesai: (t) => t.status === "selesai",
  };

  const filtered = tasks.filter(tabFilter[activeTab]);

  const stats = {
    total: tasks.length,
    aktif: tasks.filter((t) => t.status === "aktif").length,
    selesai: tasks.filter((t) => t.status === "selesai").length,
  };

  if (!teamId) {
    return (
      <PageLayout showBrand withBottomNav>
        <main className="pb-4">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
            <h1 className="text-xl font-bold tracking-tight">Tugas Survei</h1>
            <p className="text-sm text-blue-200 mt-1">Tidak ada tim</p>
          </section>
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center py-12 text-[#476788]">
              <Icon name="group_off" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Anda belum ditugaskan ke tim manapun</p>
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
          <h1 className="text-xl font-bold tracking-tight">Tugas Survei</h1>
          <p className="text-sm text-blue-200 mt-1">
            {tasks.length} ruas — {stats.aktif} aktif
          </p>
        </section>

        <div className="max-w-5xl mx-auto px-4">
          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-[#E11D48] flex items-center gap-2">
              <Icon name="error" className="!text-lg shrink-0" />
              Gagal memuat data. Tarik ke bawah untuk mencoba lagi.
            </div>
          )}

          {/* Search + Tab */}
          <section className="mb-4 flex gap-2">
            <div className="flex gap-1 bg-[#EEF3FA] rounded-lg p-1">
              {(["aktif", "semua", "selesai"] as TabKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                    activeTab === key ? "bg-white text-[#1e40af] shadow-sm" : "text-[#476788] hover:text-[#1e40af]"
                  }`}
                >
                  {key === "aktif" ? "Aktif" : key === "selesai" ? "Selesai" : "Semua"}
                  {" ("}{stats[key]}{")"}
                </button>
              ))}
            </div>
          </section>

          {/* Loading */}
          {isFetching && (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#D0DAE8] rounded-xl p-4 animate-pulse">
                  <div className="w-3/4 h-5 bg-[#D0DAE8] rounded mb-2" />
                  <div className="w-1/2 h-4 bg-[#E8F0FA] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!isFetching && filtered.length === 0 && (
            <div className="text-center py-12 text-[#476788]">
              <Icon name="inbox" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Tidak ada ruas untuk tim Anda</p>
            </div>
          )}

          {/* Road list */}
          <div className="flex flex-col gap-2">
            {filtered.map((task) => (
              <Link
                key={task.id}
                to="/detail-survei"
                search={{ taskId: task.id }}
                className="bg-white border border-[#D0DAE8] rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 mr-2">
                  <h4 className="text-[14px] font-bold text-[#0F172A] truncate">{task.road_name}</h4>
                  <div className="flex items-center gap-2 text-[12px] text-[#64748B] mt-1">
                    {task.kecamatan && <span>Kec. {task.kecamatan}</span>}
                    {task.road_length_m != null && <span>{task.road_length_m} m</span>}
                    {task.reports_count != null && task.reports_count > 0 && (
                      <span>{task.reports_count} foto</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === "aktif"
                        ? "bg-blue-50 text-[#1e40af] border border-blue-200"
                        : "bg-green-50 text-[#10B981] border border-green-200"
                    }`}
                  >
                    {task.status === "aktif" ? "Aktif" : "Selesai"}
                  </span>
                  <Icon name="chevron_right" className="!text-lg text-[#94A3B8]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}

export default TugasSurveiPage;
