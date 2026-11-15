package com.jalankita.app.core.network

/**
 * Mapper [WargaReportDto] → [ReportItemDto] (kanonik).
 *
 * Kartu laporan diseragamkan jadi satu komponen `ui/components/report/ReportCard`
 * yang seluruh parameter per-perannya bertipe [ReportItemDto]
 * (PR-4 PLAN-kartu-thumbnail-detail-tinggi.md). Sebagai konsekuensinya daftar
 * warga (beranda + tab Laporan) mengonversi datanya lebih dulu.
 *
 * Catatan:
 * - `imageOriginalUrl` diisi `firstPhotoUrl` — backend daftar warga tidak
 *   mengirim `image_original_url`.
 * - `isDuplicate = false` dipaksai: `WargaReportController::index` menghitung
 *   `is_duplicate` lewat `relationLoaded('duplicateOf')` yang tidak pernah
 *   ter-load, sehingga nilainya selalu false. Badge "Duplikat" memang tidak
 *   ditampilkan untuk warga.
 */
fun WargaReportDto.toReportItem(): ReportItemDto = ReportItemDto(
    id = id,
    reportCode = reportCode,
    reporterName = reporterName,
    roadName = roadName,
    district = district,
    overallSeverity = overallSeverity,
    aiSeverity = aiSeverity,
    status = status,
    source = source,
    imageOriginalUrl = firstPhotoUrl,
    imageResultUrl = imageResultUrl,
    firstPhotoUrl = firstPhotoUrl,
    latitude = null,
    longitude = null,
    kerusakanPanjang = kerusakanPanjang,
    kerusakanLebar = kerusakanLebar,
    progressUpdatesCount = progressUpdatesCount,
    deadlineReview = deadlineReview,
    deadlineResolusi = deadlineResolusi,
    statusDeadline = statusDeadline,
    estimasiHari = estimasiHari,
    terlambatReview = terlambatReview,
    terlambatResolusi = terlambatResolusi,
    pciScore = pciScore,
    isDuplicate = false,
    createdAt = createdAt,
)
