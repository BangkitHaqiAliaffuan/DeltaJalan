let scriptLoaded = false;
let loadingPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    console.log("[reCAPTCHA] Site key tidak dikonfigurasi (VITE_RECAPTCHA_SITE_KEY kosong)");
    scriptLoaded = true;
    return Promise.resolve();
  }
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="recaptcha/api.js"]');
    if (existing) {
      console.log("[reCAPTCHA] Script sudah ada di DOM, reuse");
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      console.log("[reCAPTCHA] Script berhasil dimuat");
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      console.error("[reCAPTCHA] Gagal memuat script dari Google");
      reject(new Error("Gagal memuat reCAPTCHA"));
    };
    document.head.appendChild(script);
    console.log("[reCAPTCHA] Script ditambahkan ke <head>, menunggu onload...");
  });
  return loadingPromise;
}

declare const grecaptcha: {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

export async function getRecaptchaToken(action = "submit_report"): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.log("[reCAPTCHA] VITE_RECAPTCHA_SITE_KEY kosong — skip reCAPTCHA");
    return null;
  }

  console.log("[reCAPTCHA] Memulai获取 token...");
  try {
    console.log("[reCAPTCHA] Load script...");
    await loadRecaptchaScript();

    console.log("[reCAPTCHA] Menunggu grecaptcha.ready...");
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    console.log("[reCAPTCHA] grecaptcha siap, execute...");

    const token = await grecaptcha.execute(siteKey, { action });
    console.log("[reCAPTCHA] Token berhasil didapat, panjang:", token.length, "karakter");
    return token;
  } catch (err) {
    console.error(
      "[reCAPTCHA] GAGAL:",
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    if (err instanceof Error && err.stack) {
      console.error("[reCAPTCHA] Stack:", err.stack);
    }
    console.error(
      "[reCAPTCHA] Site key terkonfigurasi:",
      !!siteKey,
      "| typeof grecaptcha:",
      typeof grecaptcha,
    );
    return null;
  }
}
