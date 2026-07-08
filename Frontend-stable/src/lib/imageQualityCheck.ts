export type QualityStatus =
  | "good"
  | "blurry"
  | "too_dark"
  | "too_bright"
  | "low_contrast"
  | "analysis_error";

export interface QualityCheckResult {
  status: QualityStatus;
  blurScore: number;
  meanBrightness: number;
  brightnessStdDev: number;
  title: string;
  message: string;
  isWarningOnly: boolean;
}

const BLUR_THRESHOLD = 100;
const DARK_THRESHOLD = 50;
const BRIGHT_THRESHOLD = 200;
const CONTRAST_THRESHOLD = 25;
const MAX_DIM = 640;

const LAPLACIAN_KERNEL = [
  [0, -1, 0],
  [-1, 4, -1],
  [0, -1, 0],
];

function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function computeLaplacian(gray: Float64Array, width: number, height: number): Float64Array {
  const result = new Float64Array((width - 2) * (height - 2));
  let idx = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const row = gray.subarray((y + ky) * width + x - 1, (y + ky) * width + x + 2);
        const k0 = LAPLACIAN_KERNEL[ky + 1];
        sum += row[0] * k0[0] + row[1] * k0[1] + row[2] * k0[2];
      }
      result[idx++] = sum;
    }
  }
  return result;
}

function variance(values: Float64Array): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let sqDiff = 0;
  for (let i = 0; i < n; i++) sqDiff += (values[i] - mean) ** 2;
  return sqDiff / n;
}

function meanStdDev(values: Float64Array): { mean: number; stdDev: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const m = sum / n;
  let sqDiff = 0;
  for (let i = 0; i < n; i++) sqDiff += (values[i] - m) ** 2;
  return { mean: m, stdDev: Math.sqrt(sqDiff / n) };
}

export async function analyzeImageQuality(file: File): Promise<QualityCheckResult> {
  try {
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        status: "analysis_error",
        blurScore: 0,
        meanBrightness: 0,
        brightnessStdDev: 0,
        title: "Gagal Membaca Gambar",
        message: "Browser tidak mendukung Canvas 2D. Kualitas foto tidak dapat diverifikasi.",
        isWarningOnly: true,
      };
    }

    let { width, height } = image;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const totalPixels = width * height;

    const gray = new Float64Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      gray[i] = rgbToGray(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    }

    const { mean: meanBrightness, stdDev: brightnessStdDev } = meanStdDev(gray);
    const laplacianResult = computeLaplacian(gray, width, height);
    const blurScore = variance(laplacianResult);

    if (blurScore < BLUR_THRESHOLD) {
      return {
        status: "blurry",
        blurScore,
        meanBrightness,
        brightnessStdDev,
        title: "Foto Kabur",
        message:
          `Foto ini terdeteksi kabur (skor ketajaman: ${blurScore.toFixed(0)}). ` +
          "Foto kabur menyulitkan sistem AI untuk mendeteksi kerusakan jalan. " +
          "Silakan ambil foto ulang dengan kamera yang lebih stabil dan pencahayaan cukup.",
        isWarningOnly: false,
      };
    }

    if (meanBrightness < DARK_THRESHOLD) {
      return {
        status: "too_dark",
        blurScore,
        meanBrightness,
        brightnessStdDev,
        title: "Foto Terlalu Gelap",
        message:
          `Foto ini terlalu gelap (rata-rata kecerahan: ${meanBrightness.toFixed(0)} dari 255). ` +
          "Foto gelap menyulitkan sistem AI untuk mendeteksi kerusakan jalan. " +
          "Silakan ambil foto ulang dengan pencahayaan yang cukup.",
        isWarningOnly: false,
      };
    }

    if (meanBrightness > BRIGHT_THRESHOLD) {
      return {
        status: "too_bright",
        blurScore,
        meanBrightness,
        brightnessStdDev,
        title: "Foto Terlalu Terang",
        message:
          `Foto ini terlalu terang (rata-rata kecerahan: ${meanBrightness.toFixed(0)} dari 255). ` +
          "Foto yang terlalu terang dapat mengurangi detail yang terdeteksi. Namun foto tetap dapat diproses jika masih menunjukkan kondisi jalan.",
        isWarningOnly: true,
      };
    }

    if (brightnessStdDev < CONTRAST_THRESHOLD) {
      return {
        status: "low_contrast",
        blurScore,
        meanBrightness,
        brightnessStdDev,
        title: "Kontras Rendah",
        message:
          `Foto ini memiliki kontras rendah (standar deviasi: ${brightnessStdDev.toFixed(1)}). ` +
          "Kontras rendah dapat mempersulit deteksi kerusakan. Namun foto tetap dapat diproses.",
        isWarningOnly: true,
      };
    }

    return {
      status: "good",
      blurScore,
      meanBrightness,
      brightnessStdDev,
      title: "",
      message: "",
      isWarningOnly: false,
    };
  } catch {
    return {
      status: "analysis_error",
      blurScore: 0,
      meanBrightness: 0,
      brightnessStdDev: 0,
      title: "Gagal Memproses Gambar",
      message: "Terjadi kesalahan saat memproses gambar untuk pengecekan kualitas. Foto tetap dapat diupload.",
      isWarningOnly: true,
    };
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat gambar"));
    };
    img.src = url;
  });
}
