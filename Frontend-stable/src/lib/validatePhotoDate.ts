/**
 * validatePhotoDate.ts
 *
 * Validasi anti-fraud tanggal foto menggunakan metadata EXIF DateTimeOriginal.
 *
 * Aturan:
 * 1. Jika DateTimeOriginal KOSONG → tolak (foto tanpa metadata tanggal ditolak)
 * 2. Jika tanggal foto > MAX_AGE_DAYS hari yang lalu dari hari ini → tolak (foto lama)
 * 3. Jika tanggal foto di masa depan → tolak (manipulasi metadata)
 * 4. Jika gagal baca EXIF → tolak (tidak bisa diverifikasi)
 * 5. Jika lolos semua → terima
 *
 * Catatan: Validasi ini HANYA berlaku untuk foto dari galeri / drag & drop.
 * Foto dari kamera langsung (capture="environment") tidak perlu validasi ini
 * karena foto diambil secara real-time.
 */

import exifr from "exifr";

// ── Konfigurasi ────────────────────────────────────────────────────────────

/** Maksimal usia foto yang diizinkan (dalam hari) */
export const MAX_AGE_DAYS = 2;

// ── Types ──────────────────────────────────────────────────────────────────

export type PhotoDateValidationStatus =
  | "valid"
  | "no_exif_date" // tidak ada metadata tanggal EXIF → DITOLAK
  | "too_old" // foto terlalu lama (> MAX_AGE_DAYS hari) → DITOLAK
  | "future_date" // tanggal foto di masa depan (manipulasi metadata) → DITOLAK
  | "exif_read_error" // gagal membaca EXIF → DITOLAK
  | "no_gps"; // tidak ada metadata lokasi EXIF → DITOLAK

/**
 * Status yang hanya membutuhkan peringatan (upload tetap lanjut).
 * Saat ini kosong — semua status error memblokir upload.
 */
export const EXIF_WARNING_ONLY_STATUSES: PhotoDateValidationStatus[] = [];

/** Cek apakah status ini hanya peringatan (tidak memblokir upload) */
export function isExifWarningOnly(status: PhotoDateValidationStatus): boolean {
  return EXIF_WARNING_ONLY_STATUSES.includes(status);
}

/** Cek apakah status ini benar-benar memblokir upload */
export function isExifBlocking(status: PhotoDateValidationStatus): boolean {
  return status !== "valid" && !isExifWarningOnly(status);
}

export interface PhotoDateValidationResult {
  status: PhotoDateValidationStatus;
  /** Tanggal pengambilan foto dari EXIF (jika berhasil dibaca) */
  photoDate: Date | null;
  /** Selisih hari dari hari ini (positif = masa lalu, negatif = masa depan) */
  ageDays: number | null;
  /** Pesan yang siap ditampilkan ke user */
  message: string;
  /** Judul untuk modal peringatan */
  title: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Parse string EXIF DateTimeOriginal ke objek Date.
 * Format EXIF: "YYYY:MM:DD HH:MM:SS"
 */
function parseExifDate(raw: unknown): Date | null {
  if (!raw) return null;

  // exifr bisa mengembalikan Date object langsung
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw === "string") {
    // Format standar EXIF: "2026:05:19 14:30:00"
    const normalized = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Hitung selisih hari antara tanggal foto dan hari ini.
 * Positif = foto di masa lalu. Negatif = foto di masa depan.
 *
 * PENTING: Normalisasi ke tengah malam (00:00:00) agar jam pengambilan foto
 * tidak mempengaruhi hasil. Foto diambil jam 23:59 hari ini tetap = 0 hari.
 */
function diffDays(photoDate: Date, today: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  // Strip jam — hanya bandingkan tanggal kalender
  const d1 = new Date(photoDate.getFullYear(), photoDate.getMonth(), photoDate.getDate());
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // d2 - d1: positif jika foto lebih lama, negatif jika foto lebih baru dari hari ini
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}

/** Format tanggal ke string Indonesia yang mudah dibaca */
function formatDateID(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Fungsi Utama ───────────────────────────────────────────────────────────

/**
 * Validasi tanggal foto dari metadata EXIF.
 *
 * @param file - File gambar yang akan divalidasi
 * @param maxAgeDays - Maksimal usia foto dalam hari (default 2)
 * @returns PhotoDateValidationResult
 */
export async function validatePhotoDate(
  file: File,
  maxAgeDays?: number,
): Promise<PhotoDateValidationResult> {
  const today = new Date();
  const maxAge = maxAgeDays ?? MAX_AGE_DAYS;

  // Baca metadata EXIF
  let exifData: Record<string, unknown> | null = null;
  try {
    exifData = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "DateTimeDigitized", "DateTime", "CreateDate"],
    });
  } catch (parseErr) {
    // File tidak punya EXIF sama sekali (PNG, screenshot, foto dari internet, dll)
    // DITOLAK — foto harus memiliki metadata tanggal untuk diverifikasi
    return {
      status: "no_exif_date",
      photoDate: null,
      ageDays: null,
      title: "Foto Tanpa Metadata",
      message:
        "Foto ini tidak memiliki metadata tanggal (EXIF), kemungkinan diunduh dari internet " +
        "atau merupakan screenshot. Upload ditolak — " +
        "gunakan foto asli yang diambil langsung dari kamera perangkat Anda.",
    };
  }

  // Coba baca DateTimeOriginal (prioritas utama) atau fallback ke field lain
  const rawDate =
    exifData?.DateTimeOriginal ??
    exifData?.DateTimeDigitized ??
    exifData?.CreateDate ??
    exifData?.DateTime ??
    null;

  // Tidak ada tanggal sama sekali
  if (!rawDate) {
    return {
      status: "no_exif_date",
      photoDate: null,
      ageDays: null,
      title: "Foto Tanpa Metadata Tanggal",
      message:
        "Foto ini tidak memiliki metadata tanggal pengambilan (EXIF), kemungkinan diunduh " +
        "dari internet atau merupakan screenshot. Upload ditolak — " +
        "gunakan foto asli yang diambil langsung dari kamera perangkat Anda.",
    };
  }

  // Parse tanggal
  const photoDate = parseExifDate(rawDate);
  if (!photoDate) {
    return {
      status: "exif_read_error",
      photoDate: null,
      ageDays: null,
      title: "Format Tanggal Tidak Terbaca",
      message:
        "Format tanggal pada metadata foto tidak dapat dibaca. " +
        "Upload ditolak — gunakan foto asli dari kamera perangkat Anda.",
    };
  }

  const ageDays = diffDays(photoDate, today);

  // Foto dari masa depan — bandingkan hanya tanggal (bukan jam)
  // Normalisasi ke tengah malam sudah dilakukan di diffDays()
  // ageDays < 0 berarti tanggal foto LEBIH BESAR dari hari ini (masa depan)
  if (ageDays < 0) {
    return {
      status: "future_date",
      photoDate,
      ageDays,
      title: "Tanggal Foto Tidak Valid",
      message:
        `Metadata foto menunjukkan tanggal pengambilan ${formatDateID(photoDate)}, ` +
        `yang merupakan tanggal di masa depan. ` +
        `Hal ini mengindikasikan metadata foto telah dimanipulasi. ` +
        `Gunakan foto asli yang diambil langsung dari kamera.`,
    };
  }

  // Foto terlalu lama
  if (ageDays > maxAge) {
    return {
      status: "too_old",
      photoDate,
      ageDays,
      title: "Foto Terlalu Lama",
      message:
        `Foto ini diambil pada ${formatDateID(photoDate)} ` +
        `(${ageDays} hari yang lalu). ` +
        `Sistem hanya menerima foto yang diambil maksimal ${maxAge} hari terakhir ` +
        `untuk memastikan laporan mencerminkan kondisi jalan terkini. ` +
        `Silakan ambil foto baru di lokasi kerusakan.`,
    };
  }

  // Lolos semua validasi
  return {
    status: "valid",
    photoDate,
    ageDays,
    title: "",
    message: "",
  };
}
