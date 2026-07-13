let scriptLoaded = false
let loadingPromise: Promise<void> | null = null

function loadRecaptchaScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    console.log("[reCAPTCHA] SiteKey kosong — nonaktif")
    scriptLoaded = true
    return Promise.resolve()
  }
  if (typeof document === "undefined") {
    return Promise.resolve()
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="recaptcha/api.js"]',
    )
    if (existing) {
      scriptLoaded = true
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    script.onload = () => {
      console.log("[reCAPTCHA] Script loaded")
      scriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error("Gagal memuat reCAPTCHA"))
    document.head.appendChild(script)
  })
  return loadingPromise
}

declare var grecaptcha: {
  ready: (callback: () => void) => void
  execute: (
    siteKey: string,
    options: { action: string },
  ) => Promise<string>
}

export async function getRecaptchaToken(
  action = "submit_report",
): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
  console.log("[reCAPTCHA] SiteKey:", siteKey ? `${siteKey.slice(0, 10)}...` : "(kosong)")
  if (!siteKey) {
    console.log("[reCAPTCHA] Tidak ada site key — return null")
    return null
  }

  try {
    console.log("[reCAPTCHA] Loading script...")
    await loadRecaptchaScript()
    console.log("[reCAPTCHA] Menunggu grecaptcha.ready...")
    await new Promise<void>((resolve) => grecaptcha.ready(resolve))
    console.log("[reCAPTCHA] grecaptcha siap, execute...")
    const token = await grecaptcha.execute(siteKey, { action })
    console.log("[reCAPTCHA] Token:", token.slice(0, 30) + "...")
    return token
  } catch (e) {
    console.warn("[reCAPTCHA] Gagal:", e)
    return null
  }
}
