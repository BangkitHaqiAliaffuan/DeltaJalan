# PLAN — AI Result Page Petugas: Reverse Geocode Autofill + Kelengkapan

> Status: analisis selesai; eksekusi.
> Permintaan: (1) pastikan ada page khusus AI result seperti `frontend-stable`;
> (2) reverse geocoding auto-fill seperti upload laporan warga.

## Temuan

| Aspek | Status native | Web (`ai-result.tsx`, 1606 baris) |
|---|---|---|
| Page khusus AI result | ✅ ADA (`AiResultScreen` + `MainScreen.AI_RESULT`) | ✅ |
| Reverse geocode autofill | ❌ **TIDAK ADA** di petugas | ✅ (`:396-424` fill `editNamaJalan`/`editKecamatan`) |
| Bbox overlay di foto | ❌ tidak ada | ✅ (`DeteksiFoto`, `:159-266`) |
| Daftar deteksi | ❌ hanya total+keparahan | ✅ per-deteksi |
| Warga punya autofill? | ✅ (`reverseGeocodePrimary`) | ✅ |

→ Aksi: (A) tambah reverse-geocoding autofill ke `LaporViewModel` (pola warga);
(B) tambah daftar deteksi + bbox overlay di `AiResultScreen`.

## Rencana

| Fase | Isi |
|---|---|
| **G1** | `LaporViewModel`: inject `ReverseGeocoder`; `roadNameLocked`/`geocoding`; `reverseGeocodePrimary()` dipanggil saat EXIF GPS siap (pola warga) |
| **G2** | Hormati kecamatan sesi patroli: jangan timpa kecamatan bila dari sesi (terkunci) |
| **G3** | `AiResultScreen`: indikator "mencari nama jalan…" + kunci field nama jalan bila `roadFound`; daftar deteksi (chip) |
| **G4** | Bbox overlay opsional (canvas di atas foto) — sesuai data `DetectionDto.bbox` |
| **G5** | Build + verifikasi ad-hoc |

## Keputusan
- Autofill pakai `ReverseGeocoder` yang SAMA dengan warga (5-tier).
- Bila laporan dari sesi patroli: `roadName` dari sesi & kecamatan terkunci → autofill TIDAK menimpa (prioritas sesi).
- Bila laporan biasa: autofill mengisi `roadName`/`district` bila masih kosong.
