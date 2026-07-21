import exifr from "exifr";

interface ExifCache {
  dateValid: boolean;
  photoDate: string | null;
  make: string;
  model: string;
  gps: { latitude: number; longitude: number } | null;
}

export async function readExifOnce(file: File): Promise<ExifCache> {
  try {
    const tags = await exifr.parse(file, true);
    if (!tags) {
      return { dateValid: false, photoDate: null, make: "", model: "", gps: null };
    }

    const rawDate =
      ((tags as Record<string, unknown>).DateTimeOriginal as string) ??
      ((tags as Record<string, unknown>).CreateDate as string) ??
      null;

    let dateValid = true;
    let photoDate: string | null = null;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        photoDate = parsed.toISOString().slice(0, 10);
        const now = new Date();
        const diffDays = (now.getTime() - parsed.getTime()) / 86400000;
        if (diffDays < 0 || diffDays > 7) dateValid = false;
      }
    }

    const make = ((tags as Record<string, unknown>).Make as string) ?? "";
    const model = ((tags as Record<string, unknown>).Model as string) ?? "";

    const lat = (tags as Record<string, unknown>).latitude as number | undefined;
    const lng = (tags as Record<string, unknown>).longitude as number | undefined;
    const gps = lat != null && lng != null ? { latitude: lat, longitude: lng } : null;

    return { dateValid, photoDate, make, model, gps };
  } catch {
    return { dateValid: false, photoDate: null, make: "", model: "", gps: null };
  }
}
