/**
 * TrustBadge.tsx
 *
 * Komponen untuk menampilkan trust score laporan.
 *
 * Tiga level:
 * - 🟢 Hijau  (>= 75) : Kredibel — supervisor bisa langsung approve
 * - 🟡 Kuning (45-74) : Perlu review manual
 * - 🔴 Merah  (< 45)  : Sangat diragukan — notif petugas untuk kirim ulang
 *
 * Trust score adalah alat bantu triase, bukan gatekeeper.
 * Supervisor tetap pengambil keputusan final.
 */

import { TrustLabel, TrustBreakdown } from '../../types/laporan';

interface TrustBadgeProps {
  score:       number;
  label:       TrustLabel;
  breakdown?:  TrustBreakdown;
  showDetail?: boolean;
}

// ── Konfigurasi visual per label ───────────────────────────────────────────

const CONFIG: Record<TrustLabel, {
  bg:     string;
  text:   string;
  border: string;
  emoji:  string;
  desc:   string;
}> = {
  hijau: {
    bg:     'bg-green-100',
    text:   'text-green-800',
    border: 'border-green-300',
    emoji:  '🟢',
    desc:   'Kredibel',
  },
  kuning: {
    bg:     'bg-yellow-100',
    text:   'text-yellow-800',
    border: 'border-yellow-300',
    emoji:  '🟡',
    desc:   'Perlu review',
  },
  merah: {
    bg:     'bg-red-100',
    text:   'text-red-800',
    border: 'border-red-300',
    emoji:  '🔴',
    desc:   'Diragukan',
  },
};

// ── Label breakdown yang ditampilkan ke user ───────────────────────────────

const BREAKDOWN_LABELS: Record<string, string> = {
  exif_gps:       'GPS EXIF',
  nama_jalan:     'Nama jalan',
  ai_deteksi:     'Deteksi AI',
  konteks_visual: 'Konteks foto',
  fake_gps:       'Keaslian GPS',
};

// ── Komponen ───────────────────────────────────────────────────────────────

export function TrustBadge({
  score,
  label,
  breakdown,
  showDetail = false,
}: TrustBadgeProps) {
  const c = CONFIG[label] ?? CONFIG.merah;

  return (
    <div className="inline-flex flex-col gap-1">
      {/* Badge utama */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full
                    text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
        title={`Trust Score: ${score}/100 — ${c.desc}`}
      >
        {c.emoji} {score}/100 — {c.desc}
      </span>

      {/* Detail breakdown (opsional) */}
      {showDetail && breakdown && (
        <div className="mt-1 space-y-0.5 min-w-[160px]">
          {Object.entries(breakdown).map(([key, val]) => (
            <div
              key={key}
              className="flex items-center justify-between text-xs text-gray-500"
            >
              <span>{BREAKDOWN_LABELS[key] ?? key}</span>
              <span
                className={
                  val.nilai > 0
                    ? 'text-green-600 font-medium'
                    : 'text-red-400'
                }
              >
                {val.nilai > 0 ? `+${val.nilai}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
