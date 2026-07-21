import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import exifr from "exifr";
import {
  reverseGeocode,
  isNativePlatform,
  nativeTakePhoto,
  convertFileSrc,
} from "@/hooks/useLocationFromPhoto";
import { PhotoExifGps } from "@jalankita/capacitor-exif-gps";
import { compressImage } from "@/lib/compressImage";
import { validatePhotoDate } from "@/lib/validatePhotoDate";
import type { PhotoDateValidationStatus } from "@/lib/validatePhotoDate";
import { readExifOnce } from "@/lib/exifCache";
import { analyzeImageQuality } from "@/lib/imageQualityCheck";
import { computeFileHash } from "@/lib/hash";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { DuplicateChecker } from "@/components/jk/DuplicateChecker";

export const Route = createFileRoute("/warga/lapor")({
  component: WargaLaporPage,
  head: () => ({ meta: [{ title: "Lapor Kerusakan — DeltaJalan" }] }),
});

const DISTRICT_OPTIONS = [
  "Sidoarjo",
  "Buduran",
  "Gedangan",
  "Sedati",
  "Waru",
  "Taman",
  "Krian",
  "Balongbendo",
  "Wonoayu",
  "Sukodono",
  "Candi",
  "Porong",
  "Krembung",
  "Tulangan",
  "Tanggulangin",
  "Jabon",
  "Tarik",
  "Prambon",
];

const UPLOAD_DAILY_LIMIT = 5;

function getDeviceId(): string {
  const key = "jalankita_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function WargaLaporPage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geoPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [reporterName] = useState(user?.name ?? "");
  const [roadName, setRoadName] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [panjang, setPanjang] = useState("");
  const [lebar, setLebar] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [qualityScoresArray, setQualityScoresArray] = useState<(string | null)[]>([]);
  const [photoHashes, setPhotoHashes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [locatingMessage, setLocatingMessage] = useState("");
  const [locationSource, setLocationSource] = useState<"exif" | "geolocation" | null>(null);
  const [geoError, setGeoError] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [cameraModel, setCameraModel] = useState("");
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fraudModal, setFraudModal] = useState<{
    isOpen: boolean;
    status: PhotoDateValidationStatus;
    title: string;
    message: string;
  }>({ isOpen: false, status: "no_exif_date", title: "", message: "" });
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  const duplicateCheck = useDuplicateCheck(
    latitude ? parseFloat(latitude) : null,
    longitude ? parseFloat(longitude) : null,
    district,
    roadName,
    locationSource !== null && !locating,
    photoHashes[0] ?? null,
  );

  const fetchRemaining = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/reports/remaining`, {
        headers: {
          "X-Device-ID": getDeviceId(),
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setServerRemaining(json.data.remaining);
      }
    } catch {
      setServerRemaining(null);
    } finally {
      setInitialized(true);
    }
  }, [token]);

  useEffect(() => {
    fetchRemaining();
  }, [fetchRemaining]);

  const cameraProps = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? { capture: "environment" as const }
    : {};
  const isCameraMode = "capture" in cameraProps;
  const isNative = isNativePlatform();
  const isBlocked = serverRemaining !== null && serverRemaining <= 0;
  const canSubmit =
    reporterName.trim().length > 0 &&
    roadName.trim().length > 0 &&
    district.length > 0 &&
    latitude.length > 0 &&
    longitude.length > 0 &&
    photos.length >= 1;

  function closeFraudModal() {
    setFraudModal((s) => ({ ...s, isOpen: false }));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setQualityScoresArray((prev) => prev.filter((_, i) => i !== index));
    setPhotoHashes((prev) => prev.filter((_, i) => i !== index));
    if (index === 0) {
      setCameraModel("");
    }
  }

  async function applyCoordinates(lat: number, lng: number, source: "exif" | "geolocation") {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    setLocationSource(source);
    setLocatingMessage("Mengidentifikasi lokasi...");

    const geo = await reverseGeocode(lat, lng);
    if (geo.namaJalan) setRoadName(geo.namaJalan);
    if (geo.kecamatan) setDistrict(geo.kecamatan);
    if (geo.fullAddress) setFullAddress(geo.fullAddress);

    setLocating(false);
  }

  async function processPhotoForGps(file: File) {
    setGeoError("");
    setLocating(true);
    setLocatingMessage("Membaca GPS dari foto...");

    // Priority 1: EXIF GPS client-side
    const gps = await exifr.gps(file);
    if (gps?.latitude && gps?.longitude) {
      await applyCoordinates(gps.latitude, gps.longitude, "exif");
      return;
    }

    // Priority 2: Browser geolocation (fallback, skip server upload)
    if (navigator.geolocation) {
      setLocatingMessage("Mendeteksi lokasi perangkat...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          geoPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          applyCoordinates(pos.coords.latitude, pos.coords.longitude, "geolocation");
        },
        () => {
          setGeoError("Gagal mendeteksi lokasi. Pastikan GPS aktif, atau isi manual.");
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
      return;
    }

    setGeoError("Geolokasi tidak didukung browser ini. Isi koordinat manual.");
    setLocating(false);
  }

  async function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;
    const remaining = 3 - photos.length;
    const toProcess = incoming.slice(0, remaining);

    setProcessing(true);
    setFraudModal((s) => ({ ...s, isOpen: false }));
    setUploadWarnings([]);

    const newPhotos: File[] = [];
    const newPreviews: string[] = [];
    const newQualityScores: (string | null)[] = [];
    const newHashes: string[] = [];
    const warnings: string[] = [];

    if (incoming.length > remaining) {
      warnings.push(
        `Hanya ${remaining} foto yang bisa ditambahkan (maks 3 foto per laporan), ${incoming.length - remaining} foto diabaikan.`,
      );
    }
    let isFirstInBatch = true;

    for (const rawFile of toProcess) {
      const compressed = await compressImage(rawFile);

      const dateVal = await validatePhotoDate(compressed, 7);
      if (dateVal.status !== "valid") {
        if (photos.length === 0 && newPhotos.length === 0) {
          setFraudModal({
            isOpen: true,
            status: dateVal.status,
            title: dateVal.title,
            message: dateVal.message,
          });
          setProcessing(false);
          return;
        }
        warnings.push(`"${rawFile.name}": ${dateVal.message}`);
        isFirstInBatch = false;
        continue;
      }

      const qualityCheck = await analyzeImageQuality(compressed);
      if (qualityCheck.status !== "good" && !qualityCheck.isWarningOnly) {
        if (photos.length === 0 && newPhotos.length === 0) {
          setFraudModal({
            isOpen: true,
            status: qualityCheck.status,
            title: qualityCheck.title,
            message: qualityCheck.message,
          });
          setProcessing(false);
          return;
        }
        warnings.push(`"${rawFile.name}": ${qualityCheck.message}`);
        isFirstInBatch = false;
        continue;
      }

      const cleanQuality = JSON.stringify({
        ...qualityCheck,
        title: undefined,
        message: undefined,
        isWarningOnly: undefined,
      });

      if (photos.length === 0 && isFirstInBatch) {
        try {
          const tags = await exifr.parse(compressed, ["Make", "Model"]);
          if (tags) {
            const make = (tags.Make as string) ?? "";
            const model = (tags.Model as string) ?? "";
            if (make || model) setCameraModel([make, model].filter(Boolean).join(" "));
          }
        } catch {
          /* empty */
        }
      }

      const hash = await computeFileHash(compressed);
      if (photoHashes.includes(hash) || newHashes.includes(hash)) {
        warnings.push(`"${rawFile.name}": Foto duplikat, dilewati`);
        isFirstInBatch = false;
        continue;
      }

      newPhotos.push(compressed);
      newPreviews.push(URL.createObjectURL(compressed));
      newQualityScores.push(cleanQuality);
      newHashes.push(hash);
      isFirstInBatch = false;
    }

    if (newPhotos.length === 0) {
      setUploadWarnings(warnings);
      setProcessing(false);
      return;
    }

    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 3));
    setPhotoPreviews((prev) => [...prev, ...newPreviews].slice(0, 3));
    setQualityScoresArray((prev) => [...prev, ...newQualityScores].slice(0, 3));
    setPhotoHashes((prev) => [...prev, ...newHashes].slice(0, 3));

    if (warnings.length > 0) setUploadWarnings(warnings);

    // GPS from first photo if this is the first batch
    if (photos.length === 0 && newPhotos.length > 0) {
      await processPhotoForGps(newPhotos[0]);
    }

    setProcessing(false);
  }

  // ── Capacitor Native Photo Handlers ──

  async function handleNativeCamera() {
    if (processing) return;
    setProcessing(true);
    setCameraModel("");
    setFraudModal((s) => ({ ...s, isOpen: false }));
    setUploadWarnings([]);

    const result = await nativeTakePhoto();
    if (!result) {
      setProcessing(false);
      return;
    }

    const exif = await readExifOnce(result.file);
    if (!exif.dateValid) {
      setFraudModal({
        isOpen: true,
        status: "too_old",
        title: "Foto Tidak Valid",
        message: exif.photoDate
          ? "Tanggal foto lebih dari 7 hari yang lalu atau di masa depan."
          : "Foto tidak memiliki metadata tanggal.",
      });
      setProcessing(false);
      return;
    }

    const compressed = await compressImage(result.file);

    const qualityCheck = await analyzeImageQuality(compressed);
    if (qualityCheck.status !== "good" && !qualityCheck.isWarningOnly) {
      setFraudModal({
        isOpen: true,
        status: qualityCheck.status,
        title: qualityCheck.title,
        message: qualityCheck.message,
      });
      setProcessing(false);
      return;
    }

    const cleanQuality = JSON.stringify({
      ...qualityCheck,
      title: undefined,
      message: undefined,
      isWarningOnly: undefined,
    });

    if (exif.make || exif.model) setCameraModel([exif.make, exif.model].filter(Boolean).join(" "));

    // Camera replaces all photos
    const hash = await computeFileHash(compressed);
    setPhotos([compressed]);
    setPhotoPreviews([URL.createObjectURL(compressed)]);
    setQualityScoresArray([cleanQuality]);
    setPhotoHashes([hash]);

    if (result.lat != null && result.lng != null) {
      await applyCoordinates(result.lat, result.lng, "exif");
    } else if (exif.gps) {
      await applyCoordinates(exif.gps.latitude, exif.gps.longitude, "exif");
    } else {
      await processPhotoForGps(compressed);
    }

    setProcessing(false);
  }

  async function handleNativeGallery() {
    if (processing) return;
    setProcessing(true);
    setFraudModal((s) => ({ ...s, isOpen: false }));
    setUploadWarnings([]);

    const pickResult = await PhotoExifGps.pickPhotos({ limit: 3 });
    if (!pickResult.photos?.length) {
      setProcessing(false);
      return;
    }

    const warnings: string[] = [];

    const results = await Promise.all(
      pickResult.photos.map(async (pick) => {
        const capUrl = convertFileSrc(pick.uri);
        let blob: Blob;
        try {
          const resp = await fetch(capUrl);
          blob = await resp.blob();
        } catch {
          return { error: `"${pick.name}": Gagal membaca foto` } as const;
        }
        const file = new File([blob], pick.name || "gallery.jpg", {
          type: blob.type || "image/jpeg",
        });

        const exif = await readExifOnce(file);
        if (!exif.dateValid) {
          return { error: `"${pick.name}": ${exif.photoDate ? "Tanggal foto lebih dari 7 hari" : "Tidak ada tanggal EXIF"}`, exif } as const;
        }

        const compressed = await compressImage(file);
        const qualityCheck = await analyzeImageQuality(compressed);
        if (qualityCheck.status !== "good" && !qualityCheck.isWarningOnly) {
          return { error: `"${pick.name}": ${qualityCheck.message}`, exif } as const;
        }

        const cleanQuality = JSON.stringify({
          ...qualityCheck,
          title: undefined,
          message: undefined,
          isWarningOnly: undefined,
        });

        const hash = await computeFileHash(compressed);
        return {
          file: compressed,
          preview: URL.createObjectURL(compressed),
          quality: cleanQuality,
          hash,
          exif,
          pick,
        } as const;
      }),
    );

    let firstExif: Awaited<ReturnType<typeof readExifOnce>> | null = null;
    const newPhotos: File[] = [];
    const newPreviews: string[] = [];
    const newQualityScores: (string | null)[] = [];
    const newHashes: string[] = [];
    const seenHashes = new Set(photoHashes);

    for (const r of results) {
      if ("error" in r) {
        if (newPhotos.length === 0 && r.exif) firstExif ??= r.exif;
        warnings.push(r.error);
        continue;
      }
      if (seenHashes.has(r.hash)) {
        warnings.push(`"${r.pick.name}": Foto duplikat, dilewati`);
        continue;
      }
      seenHashes.add(r.hash);
      firstExif ??= r.exif;
      newPhotos.push(r.file);
      newPreviews.push(r.preview);
      newQualityScores.push(r.quality);
      newHashes.push(r.hash);
    }

    if (newPhotos.length === 0) {
      if (results.length > 0 && "error" in results[0]) {
        setFraudModal({
          isOpen: true,
          status: "too_old",
          title: "Foto Tidak Valid",
          message: warnings[0] ?? "Foto tidak memenuhi syarat.",
        });
      }
      setUploadWarnings(warnings);
      setProcessing(false);
      return;
    }

    if (firstExif?.make || firstExif?.model) {
      setCameraModel([firstExif.make, firstExif.model].filter(Boolean).join(" "));
    }

    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 3));
    setPhotoPreviews((prev) => [...prev, ...newPreviews].slice(0, 3));
    setQualityScoresArray((prev) => [...prev, ...newQualityScores].slice(0, 3));
    setPhotoHashes((prev) => [...prev, ...newHashes].slice(0, 3));
    if (warnings.length > 0) setUploadWarnings(warnings);

    // GPS from first photo
    const first = photos.concat(newPhotos).slice(0, 3)[0];
    const firstPick = pickResult.photos[0];
    if (firstPick.lat != null && firstPick.lng != null) {
      await applyCoordinates(firstPick.lat, firstPick.lng, "exif");
    } else if (firstExif?.gps) {
      await applyCoordinates(firstExif.gps.latitude, firstExif.gps.longitude, "exif");
    } else if (first) {
      await processPhotoForGps(first);
    }

    setProcessing(false);
  }

  async function handleSubmit() {
    if (loading) return;
    setError("");

    if (locating) {
      setError("Tunggu hingga lokasi terdeteksi.");
      return;
    }
    if (geoError) {
      setError("Perbaiki error lokasi sebelum mengirim.");
      return;
    }
    if (!reporterName || !roadName || !district || !latitude || !longitude || photos.length === 0) {
      setError("Semua field wajib diisi, termasuk foto.");
      return;
    }

    setLoading(true);

    const captchaToken = await getRecaptchaToken();
    if (!captchaToken && import.meta.env.VITE_RECAPTCHA_SITE_KEY && !isNative) {
      setError("Verifikasi keamanan gagal. Silakan reload halaman.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("reporter_name", reporterName);
      formData.append("road_name", roadName);
      formData.append("district", district);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      photos.forEach((f, i) => {
        formData.append(`images[${i}]`, f);
        if (qualityScoresArray[i]) {
          formData.append(`quality_scores[${i}]`, qualityScoresArray[i]);
        }
      });
      if (description) formData.append("description", description);
      if (panjang) formData.append("kerusakan_panjang", panjang);
      if (lebar) formData.append("kerusakan_lebar", lebar);
      if (fullAddress) formData.append("full_address", fullAddress);
      if (captchaToken) formData.append("captcha_token", captchaToken);

      const res = await fetch(`${API_BASE_URL}/warga/reports`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": getDeviceId(),
        },
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        fetchRemaining();
        setSuccess("Laporan berhasil dikirim! Menunggu verifikasi petugas.");
        setTimeout(() => navigate({ to: "/warga/laporan" }), 2000);
      } else {
        if (json.error_code === "IMAGE_NOT_RELEVANT") {
          setFraudModal({
            isOpen: true,
            status: "image_not_relevant",
            title: "Foto Tidak Relevan",
            message: json.message ?? "Foto tidak relevan dengan kerusakan jalan.",
          });
        } else {
          setError(json.message ?? "Gagal mengirim laporan.");
        }
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  if (!initialized) {
    return (
      <PageLayout showBrand withBottomNav>
        <main className="flex-1 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-20">
        {!success && isBlocked ? (
          <>
            <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
              <h1 className="text-xl font-bold tracking-tight">Batas Upload Tercapai</h1>
            </section>
            <div className="flex-1 flex items-center justify-center px-4 mt-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="hourglass" className="!text-3xl text-[#D97706]" />
                </div>
                <p className="font-label-lg text-label-lg font-semibold text-[#0F172A] mb-2">
                  Anda telah mencapai batas upload harian
                </p>
                <p className="font-body-md text-body-md text-[#475569] mb-6">
                  Maksimal {UPLOAD_DAILY_LIMIT} laporan per hari. Silakan coba lagi besok.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
              <h1 className="text-xl font-bold tracking-tight">Laporkan Kerusakan Jalan</h1>
              <p className="text-sm text-blue-200 mt-1">Isi data kerusakan yang Anda temukan</p>
              <div className="mt-3 flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 w-fit text-xs font-medium text-blue-100">
                <Icon name="assignment" className="!text-[14px]" />
                {serverRemaining !== null
                  ? `Sisa: ${serverRemaining} / ${UPLOAD_DAILY_LIMIT} laporan`
                  : `${UPLOAD_DAILY_LIMIT} / ${UPLOAD_DAILY_LIMIT} laporan`}
              </div>
            </section>
            <div className="max-w-xl mx-auto px-4 mt-6">
              {success && (
                <div className="mb-4 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <Icon
                    name="check_circle"
                    className="text-[#16A34A] !text-[18px] shrink-0 mt-0.5"
                  />
                  <p className="font-body-sm text-body-sm text-[#16A34A] leading-relaxed">
                    {success}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Foto Kerusakan
                  </label>

                  {isNative ? (
                    <>
                      {processing ? (
                        <div className="border-2 border-dashed border-[#c4c5d5] rounded-lg p-6 text-center">
                          <div className="flex flex-col items-center gap-2 py-4">
                            <span className="w-8 h-8 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                            <p className="text-xs text-[#476788]">Memproses foto...</p>
                          </div>
                        </div>
                      ) : photos.length === 0 ? (
                        <>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={handleNativeCamera}
                              className="flex-1 border-2 border-dashed border-[#c4c5d5] rounded-lg p-4 text-center hover:border-[#1e40af] hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <Icon name="camera_alt" className="!text-3xl text-[#757684]" />
                                <p className="text-sm text-[#757684]">Ambil Foto</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={handleNativeGallery}
                              className="flex-1 border-2 border-dashed border-[#c4c5d5] rounded-lg p-4 text-center hover:border-[#1e40af] hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <Icon name="photo_library" className="!text-3xl text-[#757684]" />
                                <p className="text-sm text-[#757684]">Pilih dari Galeri</p>
                              </div>
                            </button>
                          </div>
                          <p className="text-[11px] text-[#64748B] text-center mt-1">
                            Maksimal 3 foto per laporan
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {photoPreviews.map((preview, idx) => (
                              <div
                                key={idx}
                                className="relative border border-[#c4c5d5] rounded-lg overflow-hidden"
                              >
                                {idx === 0 && (
                                  <span className="absolute top-1 left-1 bg-[#1e40af] text-white text-[10px] px-1.5 py-0.5 rounded font-semibold z-10">
                                    Utama
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removePhoto(idx)}
                                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-10 hover:bg-black/70 transition-colors"
                                >
                                  ✕
                                </button>
                                <img
                                  src={preview}
                                  alt={`Foto ${idx + 1}`}
                                  className="w-full h-28 object-cover"
                                />
                                <p className="text-[10px] text-[#476788] truncate px-1 py-0.5 bg-gray-50">
                                  {photos[idx]?.name}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={handleNativeCamera}
                              className="flex-1 h-10 border border-[#c4c5d5] rounded-lg text-xs text-[#475569] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={handleNativeGallery}
                              className="flex-1 h-10 border border-[#c4c5d5] rounded-lg text-xs text-[#475569] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              {photos.length < 3
                                ? `Tambah Foto (${3 - photos.length} sisa)`
                                : "Pilih Ulang"}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#c4c5d5] rounded-lg p-4 text-center cursor-pointer hover:border-[#1e40af] hover:bg-blue-50/50 transition-colors"
                      >
                        {processing ? (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <span className="w-8 h-8 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                            <p className="text-xs text-[#476788]">Kompresi dan validasi foto...</p>
                          </div>
                        ) : photos.length > 0 ? (
                          <div>
                            <div className="grid grid-cols-2 gap-2">
                              {photoPreviews.map((preview, idx) => (
                                <div
                                  key={idx}
                                  className="relative border border-[#c4c5d5] rounded-lg overflow-hidden"
                                >
                                  {idx === 0 && (
                                    <span className="absolute top-1 left-1 bg-[#1e40af] text-white text-[10px] px-1.5 py-0.5 rounded font-semibold z-10">
                                      Utama
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePhoto(idx);
                                    }}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-10 hover:bg-black/70 transition-colors"
                                  >
                                    ✕
                                  </button>
                                  <img
                                    src={preview}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-full h-28 object-cover"
                                  />
                                  <p className="text-[10px] text-[#476788] truncate px-1 py-0.5 bg-gray-50">
                                    {photos[idx]?.name}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {photos.length < 3 && (
                              <p className="text-xs text-[#1e40af] mt-2 flex items-center justify-center gap-1">
                                <Icon name="add_photo_alternate" className="!text-[14px]" />
                                Ketuk untuk tambah foto ({3 - photos.length} sisa)
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <Icon name="camera_alt" className="!text-4xl text-[#757684]" />
                            <p className="text-sm text-[#757684]">
                              {isCameraMode
                                ? "Ketuk untuk mengambil foto"
                                : "Ketuk untuk memilih foto"}
                            </p>
                            <p className="text-xs text-[#757684]">
                              JPEG/PNG, maks 5 MB, maks 3 foto
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png"
                        onChange={handlePhotosChange}
                        className="hidden"
                        {...cameraProps}
                      />
                      {cameraModel && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#476788] mt-1">
                          <Icon name="photo_camera" className="!text-[14px]" />
                          <span>Kamera: {cameraModel}</span>
                        </div>
                      )}
                    </>
                  )}

                  {uploadWarnings.length > 0 && (
                    <div className="flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      {uploadWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-[#D97706] flex items-start gap-1.5">
                          <Icon name="warning" className="!text-[14px] shrink-0 mt-0.5" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Nama Pelapor
                  </label>
                  <div className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] bg-gray-50 flex items-center">
                    <Icon name="person" className="!text-[18px] text-[#476788] mr-2" />
                    <span>{reporterName}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Lokasi
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] bg-gray-50 flex items-center gap-2">
                      {locating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                          <span className="text-sm text-[#476788]">{locatingMessage}</span>
                        </>
                      ) : (
                        <>
                          <Icon name="my_location" className="!text-[18px] text-[#16A34A]" />
                          <span className="text-sm text-[#0F172A]">
                            {latitude}, {longitude}
                          </span>
                          <span className="text-[10px] text-[#476788] ml-auto">
                            {locationSource === "exif" ? "dari foto" : "dari perangkat"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {geoError && (
                    <p className="text-xs text-[#E11D48] flex items-center gap-1 mt-1">
                      <Icon name="warning" className="!text-[14px]" />
                      {geoError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Nama Jalan
                  </label>
                  {locationSource && (
                    <p className="text-[11px] text-[#16A34A] flex items-center gap-1 mb-1">
                      <Icon name="check_circle" className="!text-[12px]" />
                      Terisi otomatis{" "}
                      {locationSource === "exif" ? "dari GPS foto" : "dari lokasi Anda"} — dapat
                      diedit
                    </p>
                  )}

                  <DuplicateChecker
                    checking={duplicateCheck.checking}
                    activeReport={duplicateCheck.activeReport}
                    nearestDistance={duplicateCheck.nearestDistance}
                    addEvidenceState={duplicateCheck.addEvidenceState}
                    addEvidenceMessage={duplicateCheck.addEvidenceMessage}
                    evidenceLimitReached={duplicateCheck.evidenceLimitReached}
                    hasFile={photos.length > 0}
                    reporterName={reporterName}
                    onSendEvidence={(reportId) =>
                      photos[0] &&
                      duplicateCheck.submitEvidence(reportId, photos[0], reporterName)
                    }
                    onOverride={duplicateCheck.reset}
                  />

                  <input
                    value={roadName}
                    onChange={(e) => setRoadName(e.target.value)}
                    placeholder="Contoh: Jl. Raya Sidoarjo"
                    className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Kecamatan
                  </label>
                  {locationSource && (
                    <p className="text-[11px] text-[#16A34A] flex items-center gap-1 mb-1">
                      <Icon name="check_circle" className="!text-[12px]" />
                      Terisi otomatis{" "}
                      {locationSource === "exif" ? "dari GPS foto" : "dari lokasi Anda"} — dapat
                      diedit
                    </p>
                  )}
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                  >
                    <option value="">Pilih kecamatan</option>
                    {DISTRICT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A] flex items-center gap-1">
                    Alamat Lengkap
                    {locationSource && (
                      <span className="text-[10px] font-normal text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                        otomatis
                      </span>
                    )}
                  </label>
                  <div className="w-full px-4 py-2.5 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] bg-gray-50 flex items-center gap-2 min-h-11">
                    <Icon name="map" className="!text-[18px] text-[#476788] shrink-0" />
                    {locating ? (
                      <span className="text-[#94A3B8]">Mengidentifikasi lokasi...</span>
                    ) : fullAddress ? (
                      <span>{fullAddress}</span>
                    ) : (
                      <span className="text-[#94A3B8]">Belum tersedia</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Deskripsi (opsional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan kondisi kerusakan yang Anda lihat..."
                    rows={3}
                    className="w-full px-4 py-3 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    Dimensi Kerusakan (opsional)
                  </label>
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1 mb-1">
                    <Icon name="info" className="!text-[12px]" />
                    Perkiraan ukuran kerusakan
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={panjang}
                      onChange={(e) => setPanjang(e.target.value)}
                      placeholder="Panjang (m)"
                      min="0.01"
                      max="100"
                      step="0.01"
                      className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                    />
                    <input
                      type="number"
                      value={lebar}
                      onChange={(e) => setLebar(e.target.value)}
                      placeholder="Lebar (m)"
                      min="0.01"
                      max="100"
                      step="0.01"
                      className="w-full h-11 px-4 border border-[#c4c5d6] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                    <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">
                      {error}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || locating || !canSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-xl font-label-md text-label-md font-semibold flex items-center justify-center gap-2 mt-2 hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Icon name="send" className="!text-[20px]" />
                      Kirim Laporan
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <FraudWarningModal
        isOpen={fraudModal.isOpen}
        status={fraudModal.status}
        title={fraudModal.title}
        message={fraudModal.message}
        onClose={closeFraudModal}
      />
    </PageLayout>
  );
}
