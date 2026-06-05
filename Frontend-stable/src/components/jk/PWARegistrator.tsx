import { useEffect } from "react";

export function PWARegistrator() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // SW registration gagal — mungkin dev mode belum generate SW
      });
    }
  }, []);

  return null;
}
