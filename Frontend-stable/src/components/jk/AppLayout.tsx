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
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] bg-[#F5F7FA] flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">{children}</div>
    </div>
  );
}
