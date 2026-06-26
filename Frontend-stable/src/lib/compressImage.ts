import imageCompression from "browser-image-compression";

const MAX_SIZE_MB = 0.8;
const MAX_WIDTH_OR_HEIGHT = 2048;
const SKIP_IF_BELOW_BYTES = 800 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_IF_BELOW_BYTES) return file;

  const compressed: Blob = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    preserveExif: true,
    initialQuality: 0.85,
  });

  if (compressed instanceof File) {
    return compressed;
  }

  return new File([compressed], file.name, { type: compressed.type });
}
