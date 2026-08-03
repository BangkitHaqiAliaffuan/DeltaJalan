import { useEffect, useRef } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true;

const EXIT_WINDOW_MS = 2000;

export function useAndroidBackButton() {
  const lastBackAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isNative) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    function exit(): void {
      const now = Date.now();

      if (now - lastBackAtRef.current <= EXIT_WINDOW_MS) {
        void import("@capacitor/app").then(({ App }) => App.exitApp());
        return;
      }

      lastBackAtRef.current = now;
      toast.info("Tekan kembali sekali lagi untuk keluar", {
        duration: EXIT_WINDOW_MS,
      });
    }

    void import("@capacitor/app").then(({ App }) => {
      if (disposed) return;

      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
        } else {
          exit();
        }
      }).then((handle) => {
        cleanup = () => handle.remove();
      });
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
}
