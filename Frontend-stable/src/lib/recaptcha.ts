let scriptLoaded = false;
let loadingPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    scriptLoaded = true;
    return Promise.resolve();
  }
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="recaptcha/api.js"]');
    if (existing) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Gagal memuat reCAPTCHA"));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

declare const grecaptcha: {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

export async function getRecaptchaToken(action = "submit_report"): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;

  try {
    await loadRecaptchaScript();
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return await grecaptcha.execute(siteKey, { action });
  } catch {
    return null;
  }
}
