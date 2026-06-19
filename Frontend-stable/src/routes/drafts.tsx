import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { listDrafts, deleteDraft, type OfflineDraft } from "@/lib/offlineDrafts";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/drafts")({
  component: DraftsPage,
  head: () => ({ meta: [{ title: "Draf Offline — DeltaJalan" }] }),
});

function DraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    listDrafts().then((d) => {
      setDrafts(d);
      setLoading(false);
    });
  }, []);

  function handleDeleteClick(id: number) {
    setDeleteTarget(id);
  }

  async function handleDeleteConfirm() {
    if (deleteTarget == null) return;
    setDeleteLoading(true);
    await deleteDraft(deleteTarget);
    setDrafts((prev) => prev.filter((d) => d.id !== deleteTarget));
    setDeleteTarget(null);
    setDeleteLoading(false);
  }

  function handleOpen(draft: OfflineDraft) {
    navigate({ to: "/upload", search: { draftId: draft.id } });
  }

  return (
    <PageLayout title="Draf Offline" back="/home">
      <div className="flex-1 px-4 py-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="cloud_off" className="text-[48px] text-[#D0DAE8] mx-auto mb-3" />
            <p className="text-[13px] text-on-surface-variant">Belum ada draf offline</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Draf akan tersimpan di sini saat Anda offline.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(draft)}
                  className="w-full text-left p-4 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      {draft.photos[0]?.thumbnail ? (
                        <img src={draft.photos[0].thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="photo" className="text-gray-300 !text-[20px]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                        {draft.roadName || "(tanpa nama jalan)"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {draft.district && (
                          <span className="text-[11px] text-[#475569] flex items-center gap-0.5">
                            <Icon name="location_on" className="!text-[12px]" />
                            {draft.district}
                          </span>
                        )}
                        <span className="text-[11px] text-[#475569]">
                          {draft.photos.length} foto
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-on-surface-variant">
                        <span>{formatDate(draft.updatedAt, { withTime: true, short: true })}</span>
                        {!draft.latitude && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-medium">
                            Tanpa GPS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => handleOpen(draft)}
                    className="flex-1 py-2.5 text-[11px] text-primary font-medium hover:bg-[#F8FAFC] transition-colors"
                  >
                    Lanjutkan
                  </button>
                  <div className="w-px bg-[#E2E8F0]" />
                  <button
                    type="button"
                    onClick={() => draft.id !== undefined && handleDeleteClick(draft.id)}
                    className="flex-1 py-2.5 text-[11px] text-red-500 font-medium hover:bg-[#FEF2F2] transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Draf?"
        message="Draf yang dihapus tidak bisa dikembalikan. Semua foto dan data akan hilang."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
