import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import exifr from "exifr";
import { reverseGeocode, readExifGpsFromServer } from "@/hooks/useLocationFromPhoto";
import { compressImage } from "@/lib/compressImage";

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
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [locatingMessage, setLocatingMessage] = useState("");
  const [locationSource, setLocationSource] = useState<"exif" | "geolocation" | null>(null);
  const [geoError, setGeoError] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    // Priority 2: EXIF GPS server-side (EXIF corrupted/tidak terbaca client)
    setLocatingMessage("Mengambil GPS dari server...");
    const serverGps = await readExifGpsFromServer(file);
    if (serverGps?.latitude && serverGps?.longitude) {
      await applyCoordinates(serverGps.latitude, serverGps.longitude, "exif");
      return;
    }

    // Priority 3: Browser geolocation (fallback)
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
    if (!reporterName || !roadName || !district || !latitude || !longitude || !photo) {
      setError("Semua field wajib diisi, termasuk foto.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("reporter_name", reporterName);
      formData.append("road_name", roadName);
      formData.append("district", district);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      formData.append("image", photo);
      if (description) formData.append("description", description);
      if (panjang) formData.append("kerusakan_panjang", panjang);
      if (lebar) formData.append("kerusakan_lebar", lebar);
      if (fullAddress) formData.append("full_address", fullAddress);

      const res = await fetch(`${API_BASE_URL}/warga/reports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccess("Laporan berhasil dikirim! Menunggu verifikasi petugas.");
        setTimeout(() => navigate({ to: "/warga/laporan" }), 2000);
      } else {
        setError(json.message ?? "Gagal mengirim laporan.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout showBrand withBottomNav>
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

          {success && (
            <div className="mb-4 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <Icon name="check_circle" className="text-[#16A34A] !text-[18px] shrink-0 mt-0.5" />
              <p className="font-body-sm text-body-sm text-[#16A34A] leading-relaxed">{success}</p>
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
                    <p className="text-sm text-[#757684]">Ketuk untuk memilih foto</p>
                    <p className="text-xs text-[#757684]">JPEG/PNG, maks 5 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handlePhotoChange}
                className="hidden"
              />
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
                  Terisi otomatis {locationSource === "exif"
                    ? "dari GPS foto"
                    : "dari lokasi Anda"}{" "}
                  — dapat diedit
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
                  <span className="text-[10px] font-normal text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">otomatis</span>
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

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || locating}
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
    </PageLayout>
  );
}
