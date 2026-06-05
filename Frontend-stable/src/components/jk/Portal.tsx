/**
 * Portal.tsx
 *
 * Render children ke document.body menggunakan React Portal.
 *
 * WAJIB digunakan untuk semua elemen overlay/modal/drawer agar:
 * - `fixed inset-0` benar-benar cover seluruh viewport (termasuk sidebar)
 * - Tidak terpengaruh oleh `overflow-hidden`, `transform`, atau `will-change`
 *   pada ancestor element
 * - Z-index bekerja relatif terhadap root stacking context
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  /** ID container yang akan digunakan. Default: "portal-root" */
  containerId?: string;
}

export function Portal({ children, containerId = "portal-root" }: PortalProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  if (typeof document !== "undefined" && !containerRef.current) {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      document.body.appendChild(el);
    }
    containerRef.current = el;
  }

  useEffect(() => {
    return () => {
      // Cleanup: hapus container jika sudah kosong
      const el = containerRef.current;
      if (el && el.childNodes.length === 0 && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (!containerRef.current) return null;

  return createPortal(children, containerRef.current);
}
