import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { SafeImage } from "@/components/jk/SafeImage";
import { getCurrentUser, getToken } from "@/lib/auth";
import { formatDate, displayStatus, statusDotStyle } from "@/lib/format";
import { useSurveyDetail, useCompleteSurvey } from "@/hooks/useSurveyQueries";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
import { readExifGps } from "@/hooks/useLocationFromPhoto";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import type { SurveyReport } from "@/types/survey";

export const Route = createFileRoute("/detail-survei")({
  component: DetailSurveiPage,
  validateSearch: (search: Record<string, unknown>) => {
    const taskId = search.taskId as string | undefined;
    return { ...(taskId ? { taskId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Survei — DeltaJalan" }] }),
});

const STATUS_STYLES: Record<string, string> = {
  aktif: "bg-blue-50 text-[#1e40af] border border-blue-200",
  selesai: "bg-green-50 text-[#10B981] border border-green-200",
  dibatalkan: "bg-gray-50 text-[#64748B] border border-gray-200",
};

function DetailSurveiPage() {
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userRole = user?.role ?? "petugas";

  const { data: task, isFetching, error } = useSurveyDetail(taskId);
  const completeMutation = useCompleteSurvey();

  const [uploading, setUploading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  useEffect(() => {
    setPendingPhotos([]);
  }, [taskId]);

  if (!task) {
    if (isFetching) {
      return (
        <PageLayout back="/" title="Detail Survei">
          <main className="flex flex-col gap-4 p-4 animate-pulse" aria-busy="true">
            <div className="bg-white border border-[#D0DAE8] rounded-xl p-4 space-y-3">
              <div className="w-3/4 h-6 bg-[#D0DAE8] rounded" />
              <div className="w-1/2 h-4 bg-[#E8F0FA] rounded" />
              <div className="flex gap-2">
                <div className="w-20 h-5 bg-[#D0DAE8] rounded-full" />
                <div className="w-20 h-5 bg-[#D0DAE8] rounded-full" />
              </div>
            </div>
            <div className="bg-white border border-[#D0DAE8] rounded-xl h-48" />
          </main>
        </PageLayout>
      );
    }
    return (
      <PageLayout back="/" title="Detail Survei">
        <main className="flex flex-col items-center justify-center gap-3 px-4 min-h-[50vh]">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <Icon name="error" className="!text-[28px] text-[#E11D48]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F172A]">
            {error?.message || "Tugas tidak ditemukan."}
          </p>
          <Link
            to={userRole === "supervisor" ? "/kelola-survei" : "/tugas-survei"}
            className="px-5 py-2 bg-[#1A4F8A] text-white text-[13px] font-medium rounded-lg hover:bg-[#153d6e] transition-colors"
          >
            Kembali
          </Link>
        </main>
      </PageLayout>
    );
  }

  const isPetugas = userRole === "petugas";
  const isAktif = task.status === "aktif";
  const canUpload = isPetugas && isAktif;
  const [confirmSelesai, setConfirmSelesai] = useState(false);

  async function handleSelesaikan() {
    try {
      await completeMutation.mutateAsync(task.id);
    } catch (e) {
      console.error("Gagal menyelesaikan tugas:", e);
    }
  }

  async function handleFilesSelected(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const newPhotos: PendingPhoto[] = [];

    for (const file of fileArray) {
      const preview = URL.createObjectURL(file);
      const gps = await readExifGps(file);
      const inBounds =
        gps && task.road_geometry?.length
          ? isPointOnRoad(gps.latitude, gps.longitude, task.road_geometry)
          : null;

      newPhotos.push({
        file,
        preview,
        gps,
        inBounds: inBounds?.inBounds ?? null,
        distance: inBounds?.distance ?? null,
        uploading: false,
      });
    }

    setPendingPhotos((prev) => [...prev, ...newPhotos]);
  }

  function getBatchGps(): { lat: number; lng: number } {
    const withGps = pendingPhotos.find((p) => p.gps);
    if (withGps?.gps) return { lat: withGps.gps.latitude, lng: withGps.gps.longitude };
    const geo = task.road_geometry;
    if (geo && geo.length > 0) {
      const lat = geo.reduce((s, p) => s + p[0], 0) / geo.length;
      const lng = geo.reduce((s, p) => s + p[1], 0) / geo.length;
      return { lat, lng };
    }
    return { lat: -7.45, lng: 112.72 };
  }

  async function handleUpload() {
    if (pendingPhotos.length === 0 || uploading) return;

    setUploading(true);
    setPendingPhotos((prev) => prev.map((p) => ({ ...p, uploading: true })));
    const token = getToken() ?? "";

    try {
      const { lat, lng } = getBatchGps();

      const fdAnalyze = new FormData();
      for (const p of pendingPhotos) fdAnalyze.append("files[]", p.file);
      fdAnalyze.append("latitude", String(lat));
      fdAnalyze.append("longitude", String(lng));

      const analyzeRes = await apiFetch(`${API_BASE_URL}/analyze-batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fdAnalyze,
      });
      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Gagal menganalisis foto");
      }
      const analyzeJson = await analyzeRes.json();
      const batchData = analyzeJson.data ?? analyzeJson;
      const batchId: string = batchData.batch_id;

      const rawAnalyses: Array<Record<string, unknown>> = batchData.analyses ?? [];
      const analysesPayload = rawAnalyses.map((a) => {
        const rawDets = a.detections as Array<Record<string, unknown>> | undefined;
        return {
          file_index: a.file_index,
          file_name: a.file_name,
          detections: Array.isArray(rawDets)
            ? rawDets.map((d) => ({
                type: (d.class ?? d.type) as string,
                confidence: d.confidence as number,
                bbox: d.bbox as [number, number, number, number],
              }))
            : [],
          severity: (a.severity as string) ?? "ringan",
          confidence: (a.confidence as number) ?? 0,
          image_result: a.image_result ?? null,
          error: a.error ?? null,
        };
      });

      const fdStore = new FormData();
      fdStore.append("batch_id", batchId);
      fdStore.append("road_name", task.road_name);
      fdStore.append("district", task.kecamatan ?? "");
      fdStore.append("latitude", String(lat));
      fdStore.append("longitude", String(lng));
      fdStore.append("koordinat_sumber", "exif");
      fdStore.append("analyses", JSON.stringify(analysesPayload));
      fdStore.append("survey_task_id", task.id);
      for (const _ of pendingPhotos) {
        fdStore.append("kerusakan_panjang[]", "0");
        fdStore.append("kerusakan_lebar[]", "0");
      }
      for (const p of pendingPhotos) fdStore.append("files[]", p.file);

      const storeRes = await apiFetch(`${API_BASE_URL}/reports/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fdStore,
      });
      if (!storeRes.ok) {
        const body = await storeRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Gagal menyimpan laporan");
      }

      setPendingPhotos([]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setPendingPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  const reports = task.reports ?? [];

  return (
    <PageLayout
      back={userRole === "supervisor" ? "/kelola-survei" : "/tugas-survei"}
      title="Detail Survei"
    >
      <main>
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
          {/* Task Info Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <h2 className="text-[17px] font-bold text-[#0F172A] mb-3">{task.road_name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow icon="location_on" value={task.kecamatan ? `Kec. ${task.kecamatan}` : "—"} />
              <InfoRow icon="group" value={task.team?.name ? `Tim: ${task.team.name}` : "—"} />
              <InfoRow icon="calendar_month" value={formatDate(task.created_at)} />
              {task.road_length_m != null && (
                <InfoRow icon="straighten" value={`${task.road_length_m} m`} />
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLES[task.status] ?? ""}`}
              >
                {task.status === "aktif"
                  ? "Aktif"
                  : task.status === "selesai"
                    ? "Selesai"
                    : "Dibatalkan"}
              </span>
            </div>
            {task.catatan && (
              <p className="mt-3 text-[13px] text-[#64748B] bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                <span className="font-semibold">Catatan:</span> {task.catatan}
              </p>
            )}
          </div>

          {/* Survey Photo Uploader */}
          {canUpload && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-3">Upload Bukti Survey</h3>

              <div className="flex gap-2 mb-4">
                <label className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1A4F8A] text-white rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-[#153d6e] transition-colors">
                  <Icon name="camera_alt" className="!text-lg" />
                  Ambil Foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFilesSelected(e.target.files);
                    }}
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#EEF3FA] text-[#476788] rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-[#E2E8F0] transition-colors">
                  <Icon name="photo_library" className="!text-lg" />
                  Pilih Galeri
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFilesSelected(e.target.files);
                    }}
                  />
                </label>
              </div>

              {pendingPhotos.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pendingPhotos.map((p, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E2E8F0] group"
                      >
                        <SafeImage src={p.preview} alt="Preview" className="w-full h-full object-cover" />
                        <div
                          className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-white ${
                            p.inBounds === true
                              ? "bg-green-500 text-white"
                              : p.inBounds === false
                                ? "bg-yellow-500 text-white"
                                : "bg-gray-300 text-gray-600"
                          }`}
                        >
                          {p.inBounds === true ? "✓" : p.inBounds === false ? "⚑" : "?"}
                        </div>
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {pendingPhotos.some((p) => p.inBounds === false) && (
                    <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-[12px] text-[#92400E] flex items-start gap-2">
                      <Icon name="warning" className="!text-base text-yellow-600 shrink-0 mt-0.5" />
                      <span>
                        {pendingPhotos.filter((p) => p.inBounds === false).length} foto berada di luar ruas jalan
                        {pendingPhotos.some((p) => p.distance != null) && (
                          <> (terjauh {Math.max(...pendingPhotos.filter((p) => p.distance != null).map((p) => p.distance!))} m)</>
                        )}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full py-2.5 bg-[#1A4F8A] text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Menganalisis...
                      </>
                    ) : (
                      <>
                        <Icon name="cloud_upload" className="!text-lg" />
                        Upload & Analisis ({pendingPhotos.length} foto)
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reports list */}
          {reports.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#0F172A]">Laporan ({reports.length})</h3>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-[#F8FAFC] transition-colors"
                  >
                    {r.first_photo_url || r.image_original_url ? (
                      <SafeImage
                        src={r.first_photo_url ?? r.image_original_url!}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#E2E8F0]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#EEF3FA] flex items-center justify-center shrink-0">
                        <Icon name="photo" className="!text-xl text-[#94A3B8]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F172A] truncate">
                        {r.report_code || "Laporan"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle(r.status)}`} />
                        <span className="text-[11px] text-[#64748B]">{displayStatus(r.status)}</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className="text-[11px] text-[#64748B]">{formatDate(r.created_at)}</span>
                      </div>
                    </div>
                    <Link
                      to="/detail-report"
                      search={{ reportId: r.id }}
                      className="shrink-0 px-2.5 py-1 bg-[#EEF3FA] text-[#476788] rounded-lg text-[11px] font-semibold hover:bg-[#E2E8F0] transition-colors"
                    >
                      Detail
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reports.length === 0 && !canUpload && (
            <div className="text-center py-8 text-[#64748B]">
              <Icon name="photo_camera" className="!text-4xl mb-2 opacity-30" />
              <p className="text-[13px]">Belum ada laporan untuk tugas ini</p>
            </div>
          )}
        </div>
      </main>

      {canUpload && (
        <footer className="sticky bottom-0 bg-white border-t border-[#E2E8F0] p-4 flex gap-2">
          <button
            onClick={() => setConfirmSelesai(true)}
            disabled={completeMutation.isPending}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {completeMutation.isPending ? "Memproses..." : <><Icon name="check_circle" className="!text-lg" /> Selesaikan Ruas Ini</>}
          </button>
        </footer>
      )}
      <ConfirmDialog
        open={confirmSelesai}
        title="Selesaikan Ruas Ini?"
        message="Tandai ruas jalan ini sebagai selesai? Laporan yang sudah diupload tetap tersimpan."
        confirmText="Ya, Selesaikan"
        onConfirm={() => { setConfirmSelesai(false); handleSelesaikan(); }}
        onCancel={() => setConfirmSelesai(false)}
      />
    </PageLayout>
  );
}

interface PendingPhoto {
  file: File;
  preview: string;
  gps: { latitude: number; longitude: number } | null;
  inBounds: boolean | null;
  distance: number | null;
  uploading: boolean;
}

function isPointOnRoad(
  lat: number,
  lng: number,
  geometry: [number, number][],
  thresholdMeters = 100,
): { inBounds: boolean; distance: number } {
  let minDist = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const d = distanceToSegment(lat, lng, geometry[i], geometry[i + 1]);
    if (d < minDist) minDist = d;
  }
  return { inBounds: minDist <= thresholdMeters, distance: Math.round(minDist) };
}

function distanceToSegment(
  lat: number,
  lng: number,
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(b[1] - a[1]);
  const dLat = toRad(b[0] - a[0]);
  const x = Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a[0])) * Math.cos(toRad(b[0]));
  const y = Math.sin(dLat / 2) ** 2;
  const segLen = 2 * R * Math.asin(Math.sqrt(x + y));

  const t =
    ((lat - a[0]) * (b[0] - a[0]) + (lng - a[1]) * (b[1] - a[1])) /
    ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  const clampedT = Math.max(0, Math.min(1, t));
  const projLat = a[0] + clampedT * (b[0] - a[0]);
  const projLng = a[1] + clampedT * (b[1] - a[1]);

  const dLat2 = toRad(projLat - lat);
  const dLon2 = toRad(projLng - lng);
  const a2 =
    Math.sin(dLat2 / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(projLat)) * Math.sin(dLon2 / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a2));
}

function InfoRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="!text-[18px] text-[#64748B] shrink-0" />
      <span className="text-[13px] text-[#0F172A]">{value}</span>
    </div>
  );
}

export default DetailSurveiPage;
