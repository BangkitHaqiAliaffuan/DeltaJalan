import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { PublicLayout } from "@/components/jk/PublicLayout";
import { Icon } from "@/components/jk/Icon";
import { API_BASE_URL } from "@/lib/aiStore";
import exifr from "exifr";
import { reverseGeocode, readExifGpsFromServer } from "@/hooks/useLocationFromPhoto";
import { compressImage } from "@/lib/compressImage";

export const Route = createFileRoute("/lapor")({
  component: PublicLaporPage,
  head: () => ({ meta: [{ title: "Lapor Kerusakan — DeltaJalan" }] }),
});

const DISTRICT_OPTIONS = [
  "Sidoarjo", "Buduran", "Gedangan", "Sedati", "Waru", "Taman",
  "Krian", "Balongbendo", "Wonoayu", "Sukodono", "Candi", "Porong",
  "Krembung", "Tulangan", "Tanggulangin", "Jabon", "Tarik", "Prambon",
];

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ reportCode: string } | null>(null);

  const cameraProps = getMobileCameraProps();
  const isCameraMode = "capture" in cameraProps;

  async function applyCoordinates(lat: number, lng: number, source: "exif" | "geolocation") {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    setLocationSource(source);
    setLocatingMessage("Mengidentifikasi lokasi...");

    const geo = await reverseGeocode(lat, lng);
    console.log("[PublicLapor] reverseGeocode result:", JSON.stringify(geo, null, 2));
    if (geo.namaJalan) setRoadName(geo.namaJalan);
    if (geo.kecamatan) setDistrict(geo.kecamatan);

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
    const compressedFile = await compressImage(file);
    setPhoto(compressedFile);
    setPhotoPreview(URL.createObjectURL(compressedFile));
    await processPhotoForGps(compressedFile);
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
    if (!reporterName || !phone || !roadName || !district || !latitude || !longitude || !photo) {
      setError("Semua field wajib diisi, termasuk foto.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("reporter_name", reporterName);
      formData.append("phone", phone);
      formData.append("road_name", roadName);
      formData.append("district", district);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      formData.append("image", photo);
      if (description) formData.append("description", description);
      if (panjang) formData.append("kerusakan_panjang", panjang);
      if (lebar) formData.append("kerusakan_lebar", lebar);

      const res = await fetch(`${API_BASE_URL}/public/reports`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccess({ reportCode: json.data?.report?.report_code ?? "" });
      } else {
        setError(json.message ?? "Gagal mengirim laporan.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <PublicLayout withBottomNav>
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
            <p className="font-body-md text-body-md text-[#475569] mb-4">
              Kode laporan Anda:
            </p>
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
              <Link
                to="/lapor"
                className="w-full h-11 border border-[#1e40af] text-[#1e40af] rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
              >
                <Icon name="add" className="!text-[20px]" />
                Laporkan Lainnya
              </Link>
            </div>
          </div>
        </main>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout showBrand withBottomNav>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Laporkan Kerusakan Jalan</h1>
          <p className="text-sm text-blue-200 mt-1">Isi data kerusakan yang Anda temukan</p>
        </section>

        <div className="max-w-xl mx-auto px-4 mt-6">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
              <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Foto Kerusakan
              </label>
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
                    <img src={photoPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                    <p className="text-xs text-[#476788] mt-2">{photo?.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Icon name="camera_alt" className="!text-4xl text-[#757684]" />
                    <p className="text-sm text-[#757684]">Ketuk untuk mengambil foto</p>
                    <p className="text-xs text-[#757684]">
                      {isCameraMode ? "Kamera akan terbuka otomatis" : "Foto harus memiliki data GPS asli"}
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
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Nama Lengkap
              </label>
              <input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                Nomor Telepon
              </label>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                />
              </div>
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <Icon name="info" className="!text-[12px]" />
                Digunakan untuk melacak laporan Anda
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
                        {locationSource === "exif" ? "dari foto" : locationSource === "geolocation" ? "dari perangkat" : ""}
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
                  Terisi otomatis {locationSource === "exif" ? "dari GPS foto" : "dari lokasi Anda"} — dapat diedit
                </p>
              )}
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
                  Terisi otomatis {locationSource === "exif" ? "dari GPS foto" : "dari lokasi Anda"} — dapat diedit
                </p>
              )}
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
              >
                <option value="">Pilih kecamatan</option>
                {DISTRICT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
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

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
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
      </main>
    </PublicLayout>
  );
}
