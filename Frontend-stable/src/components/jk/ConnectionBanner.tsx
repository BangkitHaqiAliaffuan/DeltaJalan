import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function ConnectionBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="bg-amber-500 px-4 py-2.5 flex items-center justify-center gap-2 text-white text-[12px] font-semibold leading-relaxed">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M0 0h24v24H0z" fill="none" stroke="none"/><path d="M3 20l7 -10" /><path d="M21 20l-7 -10" /><path d="M10 20l4 -5.5" /><path d="M14 14.5l2 -3" /></svg>
      Kamu sedang offline — isi data bisa <strong>disimpan sebagai draf</strong>. Nama jalan &amp; kecamatan terisi otomatis saat online.
    </div>
  );
}
