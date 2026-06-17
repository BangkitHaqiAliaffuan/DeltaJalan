import { Sidebar } from "./Sidebar";

/**
 * AppLayout — wrapper utama untuk semua halaman setelah login.
 *
 * PENTING: Jangan tambahkan `overflow-hidden`, `transform`, `filter`,
 * atau `will-change` pada elemen ini atau Sidebar. Property tersebut
 * akan membuat `position: fixed` pada child (modal, toast, dll) menjadi
 * relatif terhadap elemen ini, bukan viewport — menyebabkan overlay
 * tidak cover seluruh layar.
 *
 * Untuk modal/overlay, selalu gunakan komponen Portal agar di-render
 * langsung ke document.body.
 */
interface AppLayoutProps {
  children: React.ReactNode;
  fullPage?: boolean;
}

export function AppLayout({ children, fullPage }: AppLayoutProps) {
  return (
    <div
      className={`bg-[#F5F7FA] flex ${fullPage ? "min-h-screen" : "h-[100dvh] overflow-hidden"}`}
    >
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 ${fullPage ? "" : "min-h-0"}`}>{children}</div>
    </div>
  );
}
