import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useSurveyList } from "@/hooks/useSurveyQueries";
import { readExifGps } from "@/hooks/useLocationFromPhoto";
import { getRoadNameFromGps } from "@/hooks/useReverseGeocode";
import {
  setAiResult,
  setFormData,
  setPendingBatchFiles,
  setBatchResult,
  API_BASE_URL,
} from "@/lib/aiStore";
import type { BatchPhotoResult } from "@/lib/aiStore";
import { AnalyzingOverlay } from "@/components/jk/AnalyzingOverlay";
import type { AnalyzeStage } from "@/components/jk/AnalyzingOverlay";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  validateSearch: (search: Record<string, unknown>) => {
    const taskId = search.taskId as string | undefined;
    return { ...(taskId ? { taskId } : {}) };
  },
  head: () => ({ meta: [{ title: "Upload & Analisis — DeltaJalan" }] }),
});

const PRIORITY_STYLES: Record<string, string> = {
  Tinggi: "bg-[#E11D48] text-white",
  Sedang: "bg-orange-50 text-[#F97316] border border-orange-200",
  Rendah: "bg-green-50 text-[#10B981] border border-green-200",
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function UploadPage() {
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const teamId = user?.team_id;
  const today = todayStr();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [analyzeState, setAnalyzeState] = useState<{
    stage: AnalyzeStage;
    variant: "single" | "batch";
    batchCount?: number;
    batchProgress?: number;
  } | null>(null);
  const [error, setError] = useState("");

  const { data: tasks = [], isFetching } = useSurveyList(
    teamId ? { team_id: teamId, tanggal_patroli: today } : undefined,
  );

  const activeTask = taskId ? tasks.find((t) => t.id === taskId) : null;

  // ── Photo handler ──

  async function handleFilePicked(file: File) {
    if (!taskId) return;
    setAnalyzeState({ stage: "gps", variant: "single" });
    setError("");

    try {
      if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
        throw new Error("Format file tidak didukung. Gunakan JPEG atau PNG.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Ukuran file maksimal 5MB.");
      }

      const previewUrl = URL.createObjectURL(file);

      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const gps = await readExifGps(file);
        if (gps?.latitude != null && gps?.longitude != null) {
          lat = gps.latitude;
          lng = gps.longitude;
        }
      } catch {}

      setAnalyzeState({ stage: "analyzing", variant: "single" });

      let roadName = activeTask?.road_name ?? "";
      const kecamatan = activeTask?.kecamatan ?? "";
      if (lat != null && lng != null) {
        try {
          const gpsRoadName = await getRoadNameFromGps(lat, lng);
          if (gpsRoadName) roadName = gpsRoadName;
        } catch {}
      }

      const analyzeFd = new FormData();
      analyzeFd.append("file", file);
      if (lat != null && lng != null) {
        analyzeFd.append("latitude", String(lat));
        analyzeFd.append("longitude", String(lng));
      }

      const analyzeRes = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: analyzeFd,
      });

      if (!analyzeRes.ok) {
        throw new Error("Gagal menganalisis foto. Silakan coba lagi.");
      }

      const analyzeJson = await analyzeRes.json();

      const mappedDets = (analyzeJson.detections ?? []).map((d: any) => ({
        class: d.type ?? d.class,
        severity: d.severity ?? analyzeJson.overall_severity,
        confidence: d.confidence,
        bbox: d.bbox
          ? { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 }
          : { x1: 0, y1: 0, x2: 0, y2: 0 },
      }));

      setAiResult({
        detections: mappedDets,
        total: analyzeJson.total ?? mappedDets.length,
        overall_severity: analyzeJson.overall_severity,
        image_result: analyzeJson.image_result ?? "",
        status: "success",
      });

      setFormData({
        namaJalan: roadName,
        kecamatan,
        tanggal: today,
        catatan: "",
        previewUrl,
        fileName: file.name,
        lat,
        lng,
        survey_task_id: taskId,
      });

      navigate({ to: "/ai-result" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAnalyzeState(null);
    }
  }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFilePicked(file);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }
    if (files.length === 1) {
      handleFilePicked(files[0]);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }
    handleBatchSelect(files);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleBatchSelect(files: FileList) {
    if (!taskId) return;
    const fileArr = Array.from(files);
    setAnalyzeState({ stage: "gps", variant: "batch", batchCount: fileArr.length });
    setError("");

    try {
      for (const f of fileArr) {
        if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
          throw new Error(`Format "${f.name}" tidak didukung. Gunakan JPEG atau PNG.`);
        }
        if (f.size > 5 * 1024 * 1024) {
          throw new Error(`Ukuran "${f.name}" melebihi 5MB.`);
        }
      }

      let lat: number = activeTask?.latitude ?? -7.45;
      let lng: number = activeTask?.longitude ?? 112.72;

      const geo = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolokasi tidak tersedia"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          enableHighAccuracy: true,
        });
      }).catch(() => null);
      if (geo) {
        lat = geo.coords.latitude;
        lng = geo.coords.longitude;
      }

      setAnalyzeState({
        stage: "analyzing",
        variant: "batch",
        batchCount: fileArr.length,
        batchProgress: 0,
      });

      const fd = new FormData();
      fileArr.forEach((f) => fd.append("files[]", f));
      fd.append("latitude", String(lat));
      fd.append("longitude", String(lng));

      const res = await fetch(`${API_BASE_URL}/analyze-batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Gagal menganalisis batch. Silakan coba lagi.");
      }

      const json = await res.json();

      setAnalyzeState({
        stage: "analyzing",
        variant: "batch",
        batchCount: fileArr.length,
        batchProgress: fileArr.length,
      });

      const photos: BatchPhotoResult[] = json.analyses.map((a: any) => ({
        fileIndex: a.file_index,
        fileName: a.file_name,
        imageResult: a.image_result ?? "",
        previewUrl: URL.createObjectURL(fileArr[a.file_index]),
        detections: (a.detections ?? []).map((d: any) => ({
          class: d.type ?? d.class,
          severity: d.severity ?? a.severity,
          confidence: d.confidence,
          bbox: d.bbox
            ? { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 }
            : { x1: 0, y1: 0, x2: 0, y2: 0 },
        })),
        severity: a.severity ?? "ringan",
        confidence: a.confidence ?? 0,
        hasError: !!a.error || !!a.exif_invalid,
      }));

      const rankOrder = ["baik", "ringan", "sedang", "berat"];
      let worstIdx = 0;
      for (const p of photos) {
        const idx = rankOrder.indexOf(p.severity.toLowerCase());
        if (idx > worstIdx) worstIdx = idx;
      }

      setPendingBatchFiles(fileArr);
      setBatchResult({
        photos,
        totalDetections: photos.reduce((s, p) => s + p.detections.length, 0),
        overallSeverity: ["Baik", "Rusak Ringan", "Rusak Sedang", "Rusak Berat"][worstIdx],
        trustScore: 0.8,
        trustLabel: "Sedang",
        batchId: json.batch_id,
        reportCode: "",
      });

      setFormData({
        namaJalan: activeTask?.road_name ?? "",
        kecamatan: activeTask?.kecamatan ?? "",
        tanggal: today,
        catatan: "",
        previewUrl: photos[0]?.previewUrl ?? "",
        fileName: fileArr[0]?.name ?? "",
        lat,
        lng,
        survey_task_id: taskId,
      });

      navigate({ to: "/ai-result" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAnalyzeState(null);
    }
  }

  // ── Guard: not petugas ──

  if (user?.role !== "petugas") {
    return (
      <PageLayout showBrand withBottomNav>
        <main className="flex flex-col items-center justify-center py-20 px-4">
          <Icon name="lock" className="!text-5xl text-[#64748B] mb-4 opacity-30" />
          <p className="text-[#475569] text-center">Halaman ini khusus petugas lapangan.</p>
        </main>
      </PageLayout>
    );
  }

  // ── Capture mode ──

  if (taskId) {
    if (!activeTask) {
      return (
        <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
          <main className="flex flex-col items-center justify-center py-20 px-4">
            <Icon name="search_off" className="!text-5xl text-[#64748B] mb-4 opacity-30" />
            <p className="text-[#475569] text-center">Jadwal tidak ditemukan.</p>
          </main>
        </PageLayout>
      );
    }

    return (
      <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
        <main className="flex flex-col min-h-full">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
            <p className="text-sm text-blue-200">Upload laporan untuk:</p>
            <h2 className="text-lg font-bold mt-1">{activeTask.road_name}</h2>
            {activeTask.kecamatan && (
              <p className="text-sm text-blue-200 mt-0.5">Kec. {activeTask.kecamatan}</p>
            )}
          </section>

          <div className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-xl w-full">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={analyzeState !== null}
                  className="flex flex-col items-center justify-center gap-2 aspect-square bg-white border-2 border-dashed border-[#C7D2FE] rounded-xl hover:border-[#A5B4FC] hover:bg-[#EEF2FF] transition-all disabled:opacity-50"
                >
                  <Icon name="camera_alt" className="!text-4xl text-[#1e40af]" />
                  <span className="text-[13px] font-semibold text-[#1e40af]">Kamera</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={analyzeState !== null}
                  className="flex flex-col items-center justify-center gap-2 aspect-square bg-white border-2 border-dashed border-[#C7D2FE] rounded-xl hover:border-[#A5B4FC] hover:bg-[#EEF2FF] transition-all disabled:opacity-50"
                >
                  <Icon name="photo_library" className="!text-4xl text-[#1e40af]" />
                  <span className="text-[13px] font-semibold text-[#1e40af]">Galeri</span>
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGallerySelect}
              />

              {analyzeState && (
                <AnalyzingOverlay
                  stage={analyzeState.stage}
                  variant={analyzeState.variant}
                  batchCount={analyzeState.batchCount}
                  batchProgress={analyzeState.batchProgress}
                />
              )}

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
                  {error}
                </div>
              )}
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  // ── List mode ──

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Upload & Analisis</h1>
          <p className="text-sm text-blue-200 mt-1">
            {isFetching ? "Memuat jadwal..." : `Jadwal patroli hari ini (${tasks.length})`}
          </p>
        </section>

        <div className="max-w-5xl mx-auto px-4">
          {isFetching && (
            <div className="flex flex-col gap-3 mt-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#D0DAE8] rounded-xl p-4 animate-pulse">
                  <div className="w-3/4 h-5 bg-[#D0DAE8] rounded mb-2" />
                  <div className="w-1/2 h-4 bg-[#E8F0FA] rounded" />
                </div>
              ))}
            </div>
          )}

          {!isFetching && tasks.length === 0 && (
            <div className="text-center py-16 text-[#476788]">
              <Icon name="calendar_month" className="!text-5xl mb-3 opacity-30 mx-auto" />
              <p className="font-body-md text-body-md">Tidak ada jadwal patroli untuk hari ini</p>
              <p className="text-sm text-[#64748B] mt-1">Cek Tugas Saya untuk melihat jadwal Anda</p>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-[#D0DAE8] rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <h4 className="text-[14px] font-bold text-[#0F172A] truncate">{task.road_name}</h4>
                    <div className="flex items-center gap-2 text-[12px] text-[#64748B] mt-0.5">
                      {task.kecamatan && <span>Kec. {task.kecamatan}</span>}
                      {task.alasan_tugas && (
                        <span className="px-1.5 py-0.5 bg-[#EEF3FA] rounded text-[10px] text-[#476788]">
                          {task.alasan_tugas.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.priority && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_STYLES[task.priority] ?? ""}`}>
                        {task.priority}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        task.status === "aktif"
                          ? "bg-blue-50 text-[#1e40af] border border-blue-200"
                          : "bg-green-50 text-[#10B981] border border-green-200"
                      }`}
                    >
                      {task.status === "aktif" ? "Aktif" : "Selesai"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] text-[#64748B]">
                  <div className="flex items-center gap-3">
                    {task.team?.name && (
                      <span className="flex items-center gap-1">
                        <Icon name="group" className="!text-sm" />
                        {task.team.name}
                      </span>
                    )}
                    {task.reports_count != null && (
                      <span>{task.reports_count} laporan</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/upload", search: { taskId: task.id } })}
                    className="px-3 py-1.5 bg-[#1e40af] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1A4F8A] transition-colors"
                  >
                    Tambahkan Laporan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
