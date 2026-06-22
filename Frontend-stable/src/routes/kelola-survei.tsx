import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { getCurrentUser } from "@/lib/auth";
import { useTeamsList } from "@/hooks/useTeamQueries";
import { useSurveyList, useDeleteSurvey } from "@/hooks/useSurveyQueries";
import { useAssignRoadToTeam, useUnassignRoadFromTeam } from "@/hooks/useSurveyPeriodQueries";
import { useRoadSearch, type RoadSuggestion } from "@/hooks/useRoadSearch";
import type { Team, SurveyTask } from "@/types/survey";

export const Route = createFileRoute("/kelola-survei")({
  component: KelolaSurveiPage,
  head: () => ({ meta: [{ title: "Kelola Survei — DeltaJalan" }] }),
});

const STATUS_BADGE: Record<string, string> = {
  aktif: "bg-blue-50 text-[#1e40af] border border-blue-200",
  selesai: "bg-green-50 text-[#10B981] border border-green-200",
};

function KelolaSurveiPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "supervisor") navigate({ to: "/" });
  }, [user, navigate]);

  const { data: teams = [] } = useTeamsList();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showAddRoad, setShowAddRoad] = useState(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
          <h1 className="text-xl font-bold tracking-tight">Kelola Survei</h1>
          <p className="text-sm text-blue-200 mt-1">Atur daftar ruas jalan per tim Satgas</p>
        </section>

        <div className="max-w-5xl mx-auto px-4">
          {/* Team selector */}
          <section className="mb-4">
            <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="group" className="!text-lg text-[#1e40af]" />
              Pilih Tim
            </h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id === selectedTeamId ? null : t.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold text-[13px] transition-all ${
                    selectedTeamId === t.id
                      ? "bg-[#1e40af] text-white shadow-md"
                      : "bg-white border border-[#D0DAE8] text-[#476788] hover:bg-[#EEF3FA]"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </section>

          {selectedTeamId && selectedTeam ? (
            <TeamRoadList teamId={selectedTeamId} team={selectedTeam} onAddRoad={() => setShowAddRoad(true)} />
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-[#476788]">
              <Icon name="group_off" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Belum ada tim terdaftar</p>
            </div>
          ) : (
            <div className="text-center py-12 text-[#476788]">
              <Icon name="tap" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Pilih tim untuk melihat daftar ruas</p>
            </div>
          )}
        </div>
      </main>

      {showAddRoad && selectedTeamId && (
        <AddRoadModal
          teamId={selectedTeamId}
          onClose={() => setShowAddRoad(false)}
          onAdded={() => setShowAddRoad(false)}
        />
      )}
    </PageLayout>
  );
}

function TeamRoadList({ teamId, team, onAddRoad }: { teamId: string; team: Team; onAddRoad: () => void }) {
  const { data: tasks = [], isFetching } = useSurveyList({ team_id: teamId });
  const deleteMutation = useDeleteSurvey();
  const removeRoadMutation = useUnassignRoadFromTeam(teamId);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const aktif = tasks.filter((t) => t.status === "aktif");
  const selesai = tasks.filter((t) => t.status === "selesai");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
          <Icon name="signpost" className="!text-lg text-[#1e40af]" />
          Daftar Ruas ({tasks.length})
        </h3>
        <button
          onClick={onAddRoad}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1A4F8A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#153d6e] transition-colors"
        >
          <Icon name="add" className="!text-[14px]" /> Tambah Ruas
        </button>
      </div>

      {isFetching ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#D0DAE8] rounded-xl p-3 animate-pulse">
              <div className="w-3/4 h-4 bg-[#D0DAE8] rounded mb-2" />
              <div className="w-1/2 h-3 bg-[#E8F0FA] rounded" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-[#476788]">
          <Icon name="road" className="!text-4xl mb-2 opacity-30" />
          <p className="text-[13px]">Belum ada ruas untuk tim ini</p>
          <button onClick={onAddRoad} className="mt-2 px-4 py-1.5 bg-[#1A4F8A] text-white text-[12px] rounded-lg">
            Tambah Ruas
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Active roads */}
          {aktif.map((road) => (
            <RoadRow
              key={road.id}
              road={road}
              onRemove={(id) => setConfirmDelete(id)}
              removing={removeRoadMutation.isPending || deleteMutation.isPending}
            />
          ))}

          {/* Completed roads (collapsed) */}
          {selesai.length > 0 && (
            <details className="group">
              <summary className="text-[11px] text-[#64748B] cursor-pointer py-2 hover:text-[#0F172A] transition-colors flex items-center gap-1">
                <Icon name="expand_more" className="!text-[16px] group-open:rotate-180 transition-transform" />
                {selesai.length} ruas selesai
              </summary>
              <div className="flex flex-col gap-2 mt-2">
                {selesai.map((road) => (
                  <RoadRow
                    key={road.id}
                    road={road}
                    onRemove={(id) => setConfirmDelete(id)}
                    removing={removeRoadMutation.isPending || deleteMutation.isPending}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete, { onSuccess: () => setConfirmDelete(null) });
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function RoadRow({ road, onRemove }: { road: SurveyTask; onRemove: (id: string) => void; removing: boolean }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="bg-white border border-[#D0DAE8] rounded-xl p-3 flex items-center justify-between hover:shadow-sm transition-shadow"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex-1 min-w-0 mr-2">
        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{road.road_name}</p>
        <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5">
          {road.kecamatan && <span>Kec. {road.kecamatan}</span>}
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${STATUS_BADGE[road.status] ?? ""}`}>
            {road.status === "aktif" ? "Aktif" : "Selesai"}
          </span>
          {road.reports_count != null && <span>{road.reports_count} foto</span>}
          {road.road_length_m != null && <span>{road.road_length_m} m</span>}
        </div>
      </div>
      <div className={`flex items-center gap-1 transition-opacity ${showActions ? "opacity-100" : "opacity-0"}`}>
        <button
          onClick={() => onRemove(road.id)}
          className="p-1.5 hover:bg-red-50 rounded-lg text-[#94A3B8] hover:text-[#E11D48] transition-colors"
          title="Hapus ruas"
        >
          <Icon name="delete" className="!text-[16px]" />
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  if (!open) return null;
  return (
    <ModalBase
      onClose={onClose}
      icon="delete"
      badge="KONFIRMASI"
      title="Hapus Ruas"
      footer={
        <div className="flex gap-2 w-full">
          <button onClick={onClose} disabled={loading} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">Batal</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold hover:bg-[#C11A3E] disabled:opacity-50 flex items-center justify-center gap-1">
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Hapus
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#475569] leading-relaxed">Hapus ruas ini dari daftar? Hanya bisa dihapus jika belum ada laporan.</p>
    </ModalBase>
  );
}

function AddRoadModal({ teamId, onClose, onAdded }: { teamId: string; onClose: () => void; onAdded: () => void }) {
  const addMutation = useAssignRoadToTeam(teamId);
  const [roadName, setRoadName] = useState("");
  const [roadNameLocked, setRoadNameLocked] = useState(false);
  const [kecamatan, setKecamatan] = useState("");
  const roadInputRef = useRef<HTMLInputElement>(null);
  const roadSearch = useRoadSearch((suggestion: RoadSuggestion) => {
    setRoadName(suggestion.roadName);
    if (suggestion.kecamatan) setKecamatan(suggestion.kecamatan);
    setRoadNameLocked(true);
  });

  function handleClose() {
    roadSearch.reset();
    setRoadName("");
    setKecamatan("");
    setRoadNameLocked(false);
    onClose();
  }

  async function handleSubmit() {
    if (!roadName.trim()) return;
    try {
      await addMutation.mutateAsync({
        road_name: roadName.trim(),
        kecamatan: kecamatan.trim() || undefined,
      });
      roadSearch.reset();
      onAdded();
    } catch (e) {
      console.error("Gagal menambah ruas:", e);
    }
  }

  function handleRoadNameChange(val: string) {
    setRoadName(val);
    if (roadNameLocked) { setRoadNameLocked(false); setKecamatan(""); }
    roadSearch.onQueryChange(val);
  }

  return (
    <ModalBase
      onClose={handleClose}
      icon="signpost"
      badge="RUAS BARU"
      title="Tambah Ruas ke Tim"
      footer={
        <>
          <button type="button" disabled={addMutation.isPending || !roadName.trim()} onClick={handleSubmit} className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] disabled:opacity-50 transition-all">
            {addMutation.isPending ? "Menyimpan..." : <><Icon name="check" className="!text-[18px]" /> Tambah Ruas</>}
          </button>
          <button type="button" onClick={handleClose} className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors">Batal</button>
        </>
      }
    >
      <div>
        <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Nama Ruas Jalan <span className="text-[#E11D48]">*</span></label>
        <div className="relative">
          <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#476788] !text-[18px] z-10" />
          <input ref={roadInputRef} value={roadName} onChange={(e) => handleRoadNameChange(e.target.value)} onFocus={() => { if (roadName.length >= 3) roadSearch.onQueryChange(roadName); }} onBlur={() => { setTimeout(() => roadSearch.onDismiss(), 150); }} className="w-full h-10 pl-9 pr-9 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" placeholder="Ketik nama jalan..." />
          {roadSearch.status === "searching" && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#476788]/30 border-t-[#476788] rounded-full animate-spin" />}
          {roadNameLocked && roadSearch.status !== "searching" && <Icon name="check_circle" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#059669] !text-[16px]" />}
        </div>
        {roadSearch.showSuggestions && (
          <div className="relative z-50">
            <ul className="absolute top-0 left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
              {roadSearch.suggestions.map((s) => (
                <li key={s.placeId}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); roadSearch.onSelect(s); }} className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] flex items-start gap-2.5 border-b border-[#E2E8F0] last:border-b-0 transition-colors">
                    <Icon name="signpost" className="text-[#1e40af] !text-[16px] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">{s.roadName}</p>
                      {s.kecamatan && <p className="text-[11px] text-[#64748B] mt-0.5">Kec. {s.kecamatan}, Sidoarjo</p>}
                    </div>
                    <Icon name="my_location" className="text-[#94A3B8] !text-[12px] shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {roadSearch.status === "not_found" && roadName.length >= 3 && <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-1"><Icon name="search_off" className="!text-[14px]" /> Tidak ditemukan di Sidoarjo.</p>}
        {roadSearch.status === "error" && <p className="text-[11px] text-[#991B1B] flex items-center gap-1 mt-1"><Icon name="wifi_off" className="!text-[14px]" /> Gagal terhubung ke layanan pencarian.</p>}
        {roadNameLocked && <p className="text-[11px] text-[#10B981] flex items-center gap-1 mt-1"><Icon name="check" className="!text-[14px]" /> Terverifikasi dari peta</p>}
      </div>
      <div>
        <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Kecamatan</label>
        <input value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} disabled={roadNameLocked} className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] outline-none disabled:bg-[#F8FAFC] disabled:text-[#64748B]" placeholder={roadNameLocked ? "Otomatis dari peta" : "Kecamatan..."} />
      </div>
    </ModalBase>
  );
}

export default KelolaSurveiPage;
