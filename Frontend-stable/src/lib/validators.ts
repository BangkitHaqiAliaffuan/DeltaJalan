const PHONE_REGEX = /^(?:\+62|62|0)8[1-9][0-9]{6,9}$/;

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

export function validateIndonesianPhone(input: string): PhoneValidationResult {
  const cleaned = input.replace(/[\s\-().]/g, "");

  if (!cleaned) {
    return { valid: false, normalized: cleaned, error: "Nomor telepon tidak boleh kosong." };
  }

  if (!PHONE_REGEX.test(cleaned)) {
    return { valid: false, normalized: cleaned, error: "Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx atau +628xxxxxxxxxx." };
  }

  let normalized = cleaned;
  if (normalized.startsWith("+62")) normalized = "0" + normalized.slice(3);
  else if (normalized.startsWith("62")) normalized = "0" + normalized.slice(2);

  return { valid: true, normalized, error: null };
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ '.-]{2,100}$/;

export interface NameValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

export function validateNamaLengkap(input: string): NameValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap tidak boleh kosong." };
  }

  if (trimmed.length < 2) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap minimal 2 karakter." };
  }

  if (trimmed.length > 100) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap maksimal 100 karakter." };
  }

  if (!NAME_REGEX.test(trimmed)) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap hanya boleh mengandung huruf, spasi, titik, dan tanda hubung." };
  }

  if (/^[ '.-]/.test(trimmed) || /[ '.-]$/.test(trimmed)) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap tidak boleh diawali atau diakhiri dengan spasi, titik, atau tanda hubung." };
  }

  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed)) {
    return { valid: false, normalized: trimmed, error: "Nama lengkap harus mengandung minimal satu huruf." };
  }

  return { valid: true, normalized: trimmed, error: null };
}
