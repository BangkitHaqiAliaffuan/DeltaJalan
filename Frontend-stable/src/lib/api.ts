import { CapacitorHttp } from "@capacitor/core";

const isNative =
  typeof window !== "undefined" &&
  typeof (window as Record<string, unknown>).Capacitor !== "undefined" &&
  (window as Record<string, unknown>).Capacitor.isNativePlatform?.() === true;

const _originalFetch = typeof window !== "undefined" ? window.fetch.bind(window) : undefined;

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function normalizeHeaders(
  headers: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = String(v);
  }
  return out;
}

function responseFromNative(res: {
  data: unknown;
  status: number;
  headers: Record<string, string> | null;
  url: string;
}): Response {
  const headers = normalizeHeaders(res.headers);
  const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    statusText: "",
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
      has: (name: string) => name.toLowerCase() in headers,
      forEach: (cb: (v: string, k: string) => void) =>
        Object.entries(headers).forEach(([k, v]) => cb(v, k)),
    } as unknown as Headers,
    json: async () => (typeof res.data === "string" ? JSON.parse(res.data) : res.data),
    text: async () => body,
    blob: async () => new Blob([body]),
    redirected: false,
    type: "cors" as ResponseType,
    url: res.url,
    clone: () => responseFromNative(res),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
    formData: async () => new FormData(),
  } as Response;
}

function isApiRequest(urlStr: string): boolean {
  if (urlStr.startsWith("/api/")) return true;
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  return apiBase ? urlStr.includes(apiBase) : false;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr =
    typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const method = (init?.method ?? "GET").toUpperCase();

  if (!isNative) {
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (apiBase && !apiBase.startsWith("/") && typeof input === "string" && input.startsWith("/api/")) {
      const base = apiBase.replace(/\/+$/, "");
      const path = input.replace(/^\/api/, "");
      return _originalFetch!(base + (path.startsWith("/") ? path : "/" + path), init);
    }
    return _originalFetch!(input, init);
  }

  let url = urlStr;
  if (url.startsWith("/api/")) {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "http://10.0.2.2:8080/api").replace(
      /\/+$/,
      "",
    );
    const path = url.replace(/^\/api/, "");
    url = base + (path.startsWith("/") ? path : "/" + path);
  }

  if (init?.signal instanceof AbortSignal && init.signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const headers = normalizeHeaders(init?.headers as Record<string, string> | undefined);

  let data: unknown = undefined;
  if (init?.body) {
    if (typeof init.body === "string") {
      data = init.body;
    } else if (isFormData(init.body)) {
      return _originalFetch!(url, init);
    } else {
      data = init.body;
    }
  }

  const options: Record<string, unknown> = { url, method, headers };

  if (data !== undefined && !["GET", "HEAD"].includes(method)) {
    options.data = data;
    if (!headers["content-type"]) {
      (options.headers as Record<string, string>)["content-type"] = "application/json";
    }
  }

  const signal = init?.signal;
  if (signal instanceof AbortSignal) {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const timeoutMs = signal as { timeout?: number };
    if (typeof timeoutMs.timeout === "number") {
      options.readTimeout = timeoutMs.timeout;
    }
  }

  try {
    const res = await CapacitorHttp.request(options as never);
    return responseFromNative(res);
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    if (errObj?.message === "Network Error") {
      throw new TypeError("Failed to fetch");
    }
    throw err;
  }
}

export function setupNativeFetch(): void {
  if (!isNative || !_originalFetch) return;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (!isApiRequest(urlStr)) {
      return _originalFetch(input, init);
    }

    try {
      return await apiFetch(input, init);
    } catch (err) {
      return _originalFetch(input, init);
    }
  };
}
