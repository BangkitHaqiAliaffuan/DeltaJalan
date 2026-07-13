import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "./aiStore";

const isNative = Capacitor.isNativePlatform?.() === true;

let _cachedOrigin: string | null = null;

function getApiOrigin(): string {
  if (_cachedOrigin) return _cachedOrigin;
  try {
    const url = new URL(API_BASE_URL);
    _cachedOrigin = url.origin;
    return _cachedOrigin;
  } catch {
    return "";
  }
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (
      isNative &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "10.0.2.2")
    ) {
      const apiOrigin = getApiOrigin();
      if (apiOrigin) {
        return url.replace(parsed.origin, apiOrigin);
      }
    }
    return url;
  } catch {
    const apiOrigin = getApiOrigin();
    if (apiOrigin) {
      const sep = url.startsWith("/") ? "" : "/";
      return `${apiOrigin}${sep}${url}`;
    }
    return url;
  }
}

export function sanitizeUrls<T>(data: T): T {
  if (typeof data === "string") {
    try {
      const parsed = new URL(data);
      if (
        isNative &&
        (parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "10.0.2.2")
      ) {
        const apiOrigin = getApiOrigin();
        if (apiOrigin) return data.replace(parsed.origin, apiOrigin) as T;
      }
    } catch {
      // relative path — skip
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeUrls) as T;
  }

  if (data && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === "string" && (key.endsWith("_url") || key === "url")) {
        result[key] = resolveImageUrl(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = sanitizeUrls(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return data;
}
