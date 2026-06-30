import { useState, useEffect, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Module-level storage — jangan sampai ke-miss meski event fire sebelum React mount
let _globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    _globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    _globalDeferredPrompt,
  );
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true,
    );

    const handler = (e: Event) => {
      e.preventDefault();
      _globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(_globalDeferredPrompt);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      _globalDeferredPrompt = null;
      setDeferredPrompt(null);
      return result.outcome === "accepted";
    }
    // Fallback: arahkan user ke manual install
    alert(
      "Untuk menginstal aplikasi, buka menu browser dan pilih\n" +
        (typeof window !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? '"Bagikan" → "Tambahkan ke Layar Utama"'
          : '"Install" atau "Tambahkan ke Layar Utama"'),
    );
    return false;
  }, [deferredPrompt]);

  return {
    canInstall: !isStandalone,
    install,
    isStandalone,
  };
}
