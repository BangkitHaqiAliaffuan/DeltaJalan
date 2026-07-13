import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { PublicLayout } from "@/components/jk/PublicLayout";
import { Icon } from "@/components/jk/Icon";
import { API_BASE_URL } from "@/lib/aiStore";
import exifr from "exifr";
import {
  reverseGeocode,
  readExifGpsFromServer,
  isNativePlatform,
  nativeTakePhoto,
  convertFileSrc,
  getBrowserLocation,
} from "@/hooks/useLocationFromPhoto";
import { compressImage } from "@/lib/compressImage";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";
import { validatePhotoDate } from "@/lib/validatePhotoDate";
import type { PhotoDateValidationStatus } from "@/lib/validatePhotoDate";
import { analyzeImageQuality } from "@/lib/imageQualityCheck";
import { PhotoExifGps } from "@jalankita/capacitor-exif-gps";
import { validateIndonesianPhone, validateNamaLengkap } from "@/lib/validators";
import { getRecaptchaToken } from "@/lib/recaptcha";

export const Route = createFileRoute("/lapor")({
  component: PublicLaporPage,
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

const UPLOAD_LOG_KEY = "jalankita_upload_log";
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

function getTodayUploadCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  const log: string[] = JSON.parse(localStorage.getItem(UPLOAD_LOG_KEY) ?? "[]");
  return log.filter((d) => d === today).length;
}

function recordUpload(): void {
  const today = new Date().toISOString().slice(0, 10);
  const log: string[] = JSON.parse(localStorage.getItem(UPLOAD_LOG_KEY) ?? "[]");
  log.push(today);
  localStorage.setItem(UPLOAD_LOG_KEY, JSON.stringify(log));
}

function getMobileCameraProps() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  return isMobile ? { capture: "environment" as const } : {};
}

function PublicLaporPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geoPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [phone, setPhone] = useState("");
  const [roadName, setRoadName] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [panjang, setPanjang] = useState("");
  const [lebar, setLebar] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [locatingMessage, setLocatingMessage] = useState("");
  const [locationSource, setLocationSource] = useState<"exif" | "geolocation" | null>(null);
  const [geoError, setGeoError] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [cameraModel, setCameraModel] = useState("");
  const [fraudModal, setFraudModal] = useState<{
    isOpen: boolean;
    status: PhotoDateValidationStatus;
    title: string;
    message: string;
  }>({ isOpen: false, status: "no_exif_date", title: "", message: "" });
  const [qualityScores, setQualityScores] = useState<string>("");
  const [error, setError] = useState("");
  const [reporterNameError, setReporterNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [success, setSuccess] = useState<{ reportCode: string } | null>(null);

  const cameraProps = getMobileCameraProps();
  const isCameraMode = "capture" in cameraProps;
  const isNative = isNativePlatform();
  const isBlocked = getTodayUploadCount() >= UPLOAD_DAILY_LIMIT;
  const canSubmit =
    reporterName.trim().length > 0 &&
    phone.trim().length > 0 &&
    roadName.trim().length > 0 &&
    district.length > 0 &&
    latitude.length > 0 &&
    longitude.length > 0 &&
    photo !== null;

  function closeFraudModal() {
    setFraudModal((s) => ({ ...s, isOpen: false }));
  }

  function handleNameBlur() {
    if (!reporterName) {
      setReporterNameError("");
      return;
    }
    const result = validateNamaLengkap(reporterName);
    if (!result.valid) {
      setReporterNameError(result.error!);
    } else {
      setReporterNameError("");
      setReporterName(result.normalized);
    }
  }

  function handlePhoneBlur() {
    if (!phone) {
      setPhoneError("");
      return;
    }
    const result = validateIndonesianPhone(phone);
    if (!result.valid) {
      setPhoneError(result.error!);
    } else {
      setPhoneError("");
      setPhone(result.normalized);
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

    const gps = await exifr.gps(file);
    if (gps?.latitude && gps?.longitude) {
      await applyCoordinates(gps.latitude, gps.longitude, "exif");
      return;
    }

    setLocatingMessage("Mengambil GPS dari server...");
    const serverGps = await readExifGpsFromServer(file);
    if (serverGps?.latitude && serverGps?.longitude) {
      await applyCoordinates(serverGps.latitude, serverGps.longitude, "exif");
      return;
    }

    if (!isCameraMode) {
      const msg =
        "Foto yang diunggah tidak memiliki data GPS. Gunakan kamera untuk mengambil foto langsung, " +
        "atau aktifkan GPS perangkat sebelum memotret.";
      setGeoError(msg);
      setLocating(false);
      return;
    }

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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setCameraModel("");
    setFraudModal((s) => ({ ...s, isOpen: false }));

    const compressedFile = await compressImage(file);

    // Validasi EXIF tanggal dulu — blocking, pakai threshold 7 hari (warga)
    const dateValidation = await validatePhotoDate(compressedFile, 7);
    if (dateValidation.status !== "valid") {
      setFraudModal({
        isOpen: true,
        status: dateValidation.status,
        title: dateValidation.title,
        message: dateValidation.message,
      });
      setProcessing(false);
      return;
    }

    // Cek kualitas foto (blur + brightness)
    const qualityCheck = await analyzeImageQuality(compressedFile);
    if (qualityCheck.status !== "good") {
      setFraudModal({
        isOpen: true,
        status: qualityCheck.status,
        title: qualityCheck.title,
        message: qualityCheck.message,
      });
      if (!qualityCheck.isWarningOnly) {
        setQualityScores(JSON.stringify(qualityCheck));
        setProcessing(false);
        return;
      }
    }
    setQualityScores(
      JSON.stringify({
        ...qualityCheck,
        title: undefined,
        message: undefined,
        isWarningOnly: undefined,
      }),
    );

    // Baca kamera (non-blocking, hanya display)
    try {
      const tags = await exifr.parse(compressedFile, ["Make", "Model"]);
      if (tags) {
        const make = (tags.Make as string) ?? "";
        const model = (tags.Model as string) ?? "";
        if (make || model) setCameraModel([make, model].filter(Boolean).join(" "));
      }
    } catch {
      // Non-blocking — camera model hanya display
    }

    // EXIF lolos — set foto dan lanjut GPS
    setPhoto(compressedFile);
    setPhotoPreview(URL.createObjectURL(compressedFile));
    await processPhotoForGps(compressedFile);
    setProcessing(false);
  }

  // ── Capacitor Native Photo Handlers ──

  async function handleNativeCamera() {
    if (processing) return;
    setProcessing(true);
    setCameraModel("");
    setFraudModal((s) => ({ ...s, isOpen: false }));

    // Pre-fetch geolocation SELAGIH dalam user gesture (button tap)
    const geoPromise = getBrowserLocation({ timeout: 10000, enableHighAccuracy: true });

    const result = await nativeTakePhoto();
    if (!result) {
      setProcessing(false);
      return;
    }

    const dateValidation = await validatePhotoDate(result.file, 7);
    if (dateValidation.status !== "valid") {
      setFraudModal({
        isOpen: true,
        status: dateValidation.status,
        title: dateValidation.title,
        message: dateValidation.message,
      });
      setProcessing(false);
      return;
    }

    const compressedFile = await compressImage(result.file);

    // Cek kualitas foto (blur + brightness)
    const qualityCheck = await analyzeImageQuality(compressedFile);
    if (qualityCheck.status !== "good") {
      setFraudModal({
        isOpen: true,
        status: qualityCheck.status,
        title: qualityCheck.title,
        message: qualityCheck.message,
      });
      if (!qualityCheck.isWarningOnly) {
        setQualityScores(JSON.stringify(qualityCheck));
        setProcessing(false);
        return;
      }
    }
    setQualityScores(
      JSON.stringify({
        ...qualityCheck,
        title: undefined,
        message: undefined,
        isWarningOnly: undefined,
      }),
    );

    setPhoto(compressedFile);
    setPhotoPreview(URL.createObjectURL(compressedFile));

    if (result.lat != null && result.lng != null) {
      await applyCoordinates(result.lat, result.lng, "exif");
    } else {
      const geo = await geoPromise;
      if (geo?.latitude && geo?.longitude) {
        await applyCoordinates(geo.latitude, geo.longitude, "geolocation");
      } else {
        await processPhotoForGps(compressedFile);
      }
    }

    setProcessing(false);
  }

  async function handleNativeGallery() {
    if (processing) return;
    setProcessing(true);
    setCameraModel("");
    setFraudModal((s) => ({ ...s, isOpen: false }));

    // Pre-fetch geolocation SELAGIH dalam user gesture (button tap)
    const geoPromise = getBrowserLocation({ timeout: 10000, enableHighAccuracy: true });

    const pickResult = await PhotoExifGps.pickPhotos({ limit: 1 });
    if (!pickResult.photos?.length) {
      setProcessing(false);
      return;
    }
    const photo = pickResult.photos[0];

    const capUrl = convertFileSrc(photo.uri);
    let blob: Blob;
    try {
      const resp = await fetch(capUrl);
      blob = await resp.blob();
    } catch {
      setError("Gagal membaca foto");
      setProcessing(false);
      return;
    }
    const file = new File([blob], photo.name || "gallery.jpg", { type: blob.type || "image/jpeg" });

    const dateValidation = await validatePhotoDate(file, 7);
    if (dateValidation.status !== "valid") {
      setFraudModal({
        isOpen: true,
        status: dateValidation.status,
        title: dateValidation.title,
        message: dateValidation.message,
      });
      setProcessing(false);
      return;
    }

    const compressedFile = await compressImage(file);

    // Cek kualitas foto (blur + brightness)
    const qualityCheck = await analyzeImageQuality(compressedFile);
    if (qualityCheck.status !== "good") {
      setFraudModal({
        isOpen: true,
        status: qualityCheck.status,
        title: qualityCheck.title,
        message: qualityCheck.message,
      });
      if (!qualityCheck.isWarningOnly) {
        setQualityScores(JSON.stringify(qualityCheck));
        setProcessing(false);
        return;
      }
    }
    setQualityScores(
      JSON.stringify({
        ...qualityCheck,
        title: undefined,
        message: undefined,
        isWarningOnly: undefined,
      }),
    );

    setPhoto(compressedFile);
    setPhotoPreview(URL.createObjectURL(compressedFile));

    if (photo.lat != null && photo.lng != null) {
      await applyCoordinates(photo.lat, photo.lng, "exif");
    } else {
      const geo = await geoPromise;
      if (geo?.latitude && geo?.longitude) {
        await applyCoordinates(geo.latitude, geo.longitude, "geolocation");
      } else {
        await processPhotoForGps(compressedFile);
      }
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
    const missing: string[] = [];
    if (!reporterName) {
      missing.push("Nama Lengkap");
    } else {
      const nameResult = validateNamaLengkap(reporterName);
      if (!nameResult.valid) {
        setReporterNameError(nameResult.error!);
        missing.push("Nama Lengkap (format tidak valid)");
      }
    }
    if (!phone) {
      missing.push("Nomor Telepon");
    } else {
      const phoneResult = validateIndonesianPhone(phone);
      if (!phoneResult.valid) {
        setPhoneError(phoneResult.error!);
        missing.push("Nomor Telepon (format tidak valid)");
      }
    }
    if (!roadName) missing.push("Nama Jalan");
    if (!district) missing.push("Kecamatan");
    if (!latitude || !longitude) missing.push("Koordinat lokasi");
    if (!photo) missing.push("Foto Kerusakan");
    if (missing.length > 0) {
      setError(`Lengkapi field berikut: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);

    const captchaToken = await getRecaptchaToken();
    if (!captchaToken && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
      setError("Verifikasi keamanan gagal. Silakan reload halaman.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("reporter_name", reporterName);
      formData.append("phone", phone);
      formData.append("road_name", roadName);
      formData.append("district", district);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      formData.append("image", photo as Blob);
      if (description) formData.append("description", description);
      if (panjang) formData.append("kerusakan_panjang", panjang);
      if (lebar) formData.append("kerusakan_lebar", lebar);
      if (fullAddress) formData.append("full_address", fullAddress);
      if (qualityScores) formData.append("quality_scores", qualityScores);
      if (captchaToken) formData.append("captcha_token", captchaToken);

      const res = await fetch(`${API_BASE_URL}/public/reports`, {
        method: "POST",
        headers: { "X-Device-ID": getDeviceId() },
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        recordUpload();
        setSuccess({ reportCode: json.data?.report?.report_code ?? "" });
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

  if (success) {
    return (
      <PublicLayout>
        <main className="pb-4">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
            <h1 className="text-xl font-bold tracking-tight">Laporan Terkirim!</h1>
          </section>
          <div className="max-w-xl mx-auto px-4 mt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="check_circle" className="!text-3xl text-[#16A34A]" />
            </div>
            <p className="font-label-lg text-label-lg font-semibold text-[#0F172A] mb-2">
              Laporan berhasil dikirim
            </p>
            <p className="font-body-md text-body-md text-[#475569] mb-4">Kode laporan Anda:</p>
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg px-6 py-4 mb-6">
              <p className="font-mono text-xl font-bold text-[#1e40af] tracking-wider">
                {success.reportCode}
              </p>
            </div>
            <p className="text-sm text-[#476788] mb-6">
              Simpan kode ini untuk melacak status laporan Anda.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/lacak"
                search={{ report_code: success.reportCode }}
                className="w-full h-11 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
              >
                <Icon name="search" className="!text-[20px]" />
                Lacak Laporan
              </Link>
              <a
                href="/lapor"
                className="w-full h-11 border border-[#1e40af] text-[#1e40af] rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
              >
                <Icon name="add" className="!text-[20px]" />
                Laporkan Lainnya
              </a>
            </div>
          </div>
        </main>
      </PublicLayout>
    );
  }

  if (isBlocked) {
    return (
      <PublicLayout back="/">
        <main className="flex-1 flex flex-col">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
            <h1 className="text-xl font-bold tracking-tight">Batas Upload Tercapai</h1>
          </section>
          <div className="flex-1 flex items-center justify-center px-4">
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
              <Link
                to="/"
                className="inline-flex h-11 px-6 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-md text-label-md font-semibold items-center justify-center gap-2 hover:shadow-lg transition-all"
              >
                <Icon name="home" className="!text-[20px]" />
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </main>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout back="/">
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Laporkan Kerusakan Jalan</h1>
          <p className="text-sm text-blue-200 mt-1">Isi data kerusakan yang Anda temukan</p>
          <div className="mt-3 flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 w-fit text-xs font-medium text-blue-100">
            <Icon name="assignment" className="!text-[14px]" />
            Sisa: {UPLOAD_DAILY_LIMIT - getTodayUploadCount()} / {UPLOAD_DAILY_LIMIT} laporan
          </div>
        </section>

        <div className="max-w-xl mx-auto px-4 mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Foto Kerusakan <span className="text-[#E11D48]">*</span>
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
                  ) : (
                    <>
                      {photoPreview ? (
                        <div className="border-2 border-dashed border-[#c4c5d5] rounded-lg p-4 text-center">
                          <div className="relative">
                            <img
                              src={photoPreview}
                              alt="Preview"
                              className="max-h-48 mx-auto rounded-lg"
                            />
                            <p className="text-xs text-[#476788] mt-2">{photo?.name}</p>
                          </div>
                        </div>
                      ) : (
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
                      )}

                      {photoPreview && (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={handleNativeCamera}
                            className="flex-1 h-10 border border-[#c4c5d5] rounded-lg text-xs text-[#475569] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            Ambil Ulang
                          </button>
                          <button
                            type="button"
                            onClick={handleNativeGallery}
                            className="flex-1 h-10 border border-[#c4c5d5] rounded-lg text-xs text-[#475569] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            Ganti dari Galeri
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#c4c5d5] rounded-lg p-6 text-center cursor-pointer hover:border-[#1e40af] hover:bg-blue-50/50 transition-colors"
                  >
                    {processing ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <span className="w-8 h-8 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                        <p className="text-xs text-[#476788]">Kompresi dan validasi foto...</p>
                      </div>
                    ) : photoPreview ? (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="max-h-48 mx-auto rounded-lg"
                        />
                        <p className="text-xs text-[#476788] mt-2">{photo?.name}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Icon name="camera_alt" className="!text-4xl text-[#757684]" />
                        <p className="text-sm text-[#757684]">Ketuk untuk mengambil foto</p>
                        <p className="text-xs text-[#757684]">
                          {isCameraMode
                            ? "Kamera akan terbuka otomatis"
                            : "Foto harus memiliki data GPS asli"}
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoChange}
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
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Nama Lengkap <span className="text-[#E11D48]">*</span>
              </label>
              <input
                value={reporterName}
                onChange={(e) => {
                  setReporterName(e.target.value);
                  setReporterNameError("");
                }}
                onBlur={handleNameBlur}
                placeholder="Nama Anda"
                className={`w-full h-11 px-4 border rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 ${reporterNameError ? "border-[#E11D48]" : "border-[#c4c5d5]"}`}
              />
              {reporterNameError && (
                <p className="text-[11px] text-[#E11D48] flex items-center gap-1">
                  <Icon name="error" className="!text-[12px]" />
                  {reporterNameError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Nomor Telepon <span className="text-[#E11D48]">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError("");
                  }}
                  onBlur={handlePhoneBlur}
                  placeholder="08xxxxxxxxxx"
                  className={`w-full h-11 px-4 border rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 ${phoneError ? "border-[#E11D48]" : "border-[#c4c5d5]"}`}
                />
              </div>
              {phoneError && (
                <p className="text-[11px] text-[#E11D48] flex items-center gap-1">
                  <Icon name="error" className="!text-[12px]" />
                  {phoneError}
                </p>
              )}
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <Icon name="info" className="!text-[12px]" />
                Contoh: 081234567890 atau +6281234567890
              </p>
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
                        {locationSource === "exif"
                          ? "dari foto"
                          : locationSource === "geolocation"
                            ? "dari perangkat"
                            : ""}
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
                Nama Jalan <span className="text-[#E11D48]">*</span>
              </label>
              {locationSource && (
                <p className="text-[11px] text-[#16A34A] flex items-center gap-1 mb-1">
                  <Icon name="check_circle" className="!text-[12px]" />
                  Terisi otomatis {locationSource === "exif"
                    ? "dari GPS foto"
                    : "dari lokasi Anda"}{" "}
                  — dapat diedit
                </p>
              )}
              {locationSource && !roadName && (
                <p className="text-[11px] text-[#D97706] flex items-center gap-1 mb-1">
                  <Icon name="warning" className="!text-[12px]" />
                  Nama jalan tidak ditemukan di database — ketik manual
                </p>
              )}
              <input
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                placeholder={
                  locationSource && !roadName ? "Ketik nama jalan..." : "Contoh: Jl. Raya Sidoarjo"
                }
                className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Kecamatan <span className="text-[#E11D48]">*</span>
              </label>
              {locationSource && (
                <p className="text-[11px] text-[#16A34A] flex items-center gap-1 mb-1">
                  <Icon name="check_circle" className="!text-[12px]" />
                  Terisi otomatis {locationSource === "exif"
                    ? "dari GPS foto"
                    : "dari lokasi Anda"}{" "}
                  — dapat diedit
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
                  className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">{error}</p>
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

            <FraudWarningModal
              isOpen={fraudModal.isOpen}
              status={fraudModal.status}
              title={fraudModal.title}
              message={fraudModal.message}
              onClose={closeFraudModal}
            />
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
