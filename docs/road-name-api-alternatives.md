# Alternatif Reverse Geocoding API untuk Nama Jalan Sidoarjo

## Masalah

LocationIQ (Tier 2) sering gagal mengembalikan `road` di Sidoarjo — response sukses tapi address.road kosong, sehingga jatuh ke fallback area `hamlet/neighbourhood/suburb`. Nominatim (Tier 1) lebih akurat untuk Sidoarjo tapi rate limit ketat (1 req/s).

## Evaluasi Alternatif

### 1. Mapbox Geocoding API v6 ⭐ **REKOMENDASI UTAMA**

| Atribut | Nilai |
|---------|-------|
| **Endpoint Reverse** | `https://api.mapbox.com/geocoding/v6/mapbox.revere/{lng},{lat}` |
| **Harga** | **Free 100.000 req/bulan** (setelah itu $0.50/1.000) |
| **Cakupan** | Global — OSM + enrichment (conflation) |
| **Nama Jalan** | Ya — `address.name` + `context` hierarki lengkap |
| **Rate Limit** | 1.000 req/menit (~16 req/s) |
| **Auth** | Token via query param `access_token` |
| **Kartu Kredit** | **Tidak perlu** untuk Temporary Geocoding (default — tidak menyimpan hasil geocode secara permanen). CC wajib hanya untuk Permanent Geocoding. |
| **Forward Geocoding** | Satu token, satu API — bisa gantiin LocationIQ di `useRoadSearch.ts` juga |

**Keunggulan dibanding api.co.id:**
-  100.000 req/bulan vs api.co.id yang 3.000/bulan (free) atau Rp 50.000/bulan
-  1 API untuk forward + reverse — satu token, dua fungsi
-  Data OSM diperkaya (conflation) — coverage nama jalan lebih lengkap dari LocationIQ/Nominatim mentah
-  Dokumentasi mature (Mapbox GL JS ecosystem)

**Catatan**: Karena sudah punya Mapbox token dan akan migrasi `useRoadSearch.ts`, penambahan reverse geocoding tidak perlu manajemen API key terpisah.

**Dokumentasi**: https://docs.mapbox.com/api/search/geocoding-v6/

---

### 2. [api.co.id](https://api.co.id/reverse-geocoding-api/)

| Atribut | Nilai |
|---------|-------|
| **Harga** | **FREE** (0 points/hit, unlimited) — tapi 3.000 req/bulan |
| **Cakupan** | Indonesia, berbasis OSM |
| **Nama Jalan** | Ya — `road`, structured address |
| **Response** | JSON, low-latency |
| **Rate Limit** | 20 req/s (Standard free) |
| **Auth** | API key via header `x-api-co-id` |
| **Kartu Kredit** | **Tidak perlu** — platform Indonesia, bisa daftar pakai Bank Jago |
| **Daftar** | https://api.co.id (email + password) |

**Catatan**: Reverse Geocoding tercantum sebagai **FREE** di tabel pricing (0 points per successful hit). Tidak perlu subscription. Cocok untuk production. Hanya 3.000 req/bulan — kurang untuk production skala Sidoarjo.

**Dokumentasi**: https://docs.api.co.id/

---

### 3. Self-hosted Nominatim (Docker)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Gratis (open source) |
| **Cakupan** | Global, data OSM Indonesia |
| **Nama Jalan** | Ya — akurat (sama dengan Tier 1 saat ini) |
| **Infra** | Perlu Docker container + 1.6 GB data Indonesia |
| **Rate Limit** | Tidak ada (self-hosted) |

**Catatan**: Bisa jalan di Docker yang sudah ada (`docker-compose.yml`). Tapi data OSM Indonesia ~1.6 GB, update periodik, dan perlu resource tambahan.

**Referensi**: https://bandithijo.dev/blog/openstreetmap-nominatim-dengan-docker

---

### 4. BigDataCloud (Reverse Geocode Free)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Gratis, 60.000 req/bulan |
| **Cakupan** | Global |
| **Nama Jalan** | **Tidak** — hanya city/region/postcode |
| **Auth** | Tidak perlu API key |

**Catatan**: Tidak mengembalikan nama jalan — tidak relevan untuk use case ini.

---

### 5. OpenCage

| Atribut | Nilai |
|---------|-------|
| **Harga** | Free tier 2.500 req/hari, paid $50+/bulan |
| **Cakupan** | Global (OSM + other sources) |
| **Nama Jalan** | Ya |
| **Kartu Kredit** | **Wajib** (untuk daftar free tier sekalipun) |

**Catatan**: Butuh CC untuk daftar. Tidak cocok.

---

### 6. MapQuest

| Atribut | Nilai |
|---------|-------|
| **Harga** | Free 15.000 req/bulan |
| **Cakupan** | Global |
| **Nama Jalan** | Ya |
| **Kartu Kredit** | **Wajib** |

**Catatan**: Butuh CC.

---

### 7. POINDT API (Perkumpulan OSM Indonesia)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Belum jelas (enterprise) |
| **Cakupan** | Indonesia |
| **Nama Jalan** | Ya (Reverse Search API) |
| **Kartu Kredit** | Tidak jelas |

**Catatan**: https://openstreetmap.or.id/poindt/ — masih baru (2025), pricing tidak publik. Hubungi langsung.

---

### 8. agfianf/reverse-geocode-api (Self-hosted)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Gratis (open source) |
| **Cakupan** | Indonesia — admin areas only (kecamatan/kabupaten/provinsi) |
| **Nama Jalan** | **Tidak** |

**Catatan**: Sama seperti wilayah-id — tidak mengembalikan nama jalan.

---

### 9. BIG_2022 / BIG_2024 (Badan Informasi Geospasial)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Gratis (BIG_2022 tanpa token) |
| **Cakupan** | Indonesia |
| **Nama Jalan** | **Tidak** — hanya kelurahan/kecamatan |
| **BIG_2024** | Error 499 (token required), registrasi ditutup |

**Catatan**: Sudah dievaluasi sebelumnya. Tidak ada nama jalan.

---

### 10. RBI BIG Road Layer (Layer 547)

| Atribut | Nilai |
|---------|-------|
| **Harga** | Gratis |
| **Cakupan** | Indonesia (RBI) |
| **Nama Jalan** | **Tidak** — NAMRJL kosong/null untuk area Sidoarjo |

**Catatan**: Sudah dievaluasi. Data geometri ada tapi atribut nama jalan kosong.

---

## Kesimpulan & Rekomendasi

| Priority | API | Alasan |
|----------|-----|--------|
| **1** | **Mapbox Geocoding API v6** | 100k req/bln gratis, tanpa CC (temporary mode), 1 token untuk forward + reverse, data OSM enriched |
| **2** | **api.co.id** | Backup/fallback — gratis, Indonesia-specific, tanpa CC (Bank Jago), tapi 3.000 req/bln |
| **3** | Self-hosted Nominatim | Long-term — paling akurat, tanpa rate limit, tapi perlu resource server |

### Catatan Penting: Temporary vs Permanent Geocoding

Mapbox punya dua mode:
- **Temporary Geocoding** (default, gratis tanpa CC) — hasil geocode **tidak boleh disimpan** di database. Cocok untuk display ke user di form.
- **Permanent Geocoding** (wajib CC) — hasil geocode **boleh disimpan** di database.

Kita pakai Temporary Geocoding untuk:
- Reverse geocode di form `/lapor` — display nama jalan ke UI
- Forward geocode di `useRoadSearch.ts` — display suggestions ke UI

`full_address` tetap bisa disimpan di database karena:
- Dibangun dari client-side (frontend menggabungkan nama jalan + admin data)
- Nama jalan berasal dari input user (bisa diedit) — bukan hasil geocode mentah yang disimpan langsung

Jadi **tidak perlu CC** selama kita hanya display, tidak simpan hasil API mentah ke DB.

### Next Step

1. Buat akun Mapbox (https://account.mapbox.com/auth/signup/) — email cukup, **tanpa kartu kredit**
2. Ambil default public token dari dashboard
3. Simpan sebagai `VITE_MAPBOX_ACCESS_TOKEN` di `.env`
4. Test reverse geocoding:

```bash
curl "https://api.mapbox.com/geocoding/v6/mapbox.revere/112.7183,-7.4531?access_token=TOKEN_ANDA&types=place,locality,neighborhood,street,address"
```

5. Jika response `address.name` mengembalikan nama jalan lengkap untuk titik yang gagal di LocationIQ:
   - Tambah Mapbox sebagai Tier 2a di `useLocationFromPhoto.ts`
   - Migrasi `useRoadSearch.ts` dari LocationIQ ke Mapbox (satu token, dua fungsi)
   - LocationIQ jadi fallback tier 2b