package com.jalankita.app.core.network

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak body POST /api/reports/{id}/mulai.
 *
 * ── Kenapa penting ──────────────────────────────────────────────────────
 * Moshi membuang field bernilai `null` (default `serializeNulls = false`).
 * Untuk pilihan "Hari ini juga" (`estimasiHari = null`) body-nya menjadi `{}`,
 * sehingga `estimasi_selesai_hari` **tidak ada** di array `$validated` server.
 * Server wajib membaca dengan `?? null`; tanpa itu PHP melempar
 * "Undefined array key" dan Laravel mengubahnya menjadi HTTP 500.
 *
 * Web tidak kena karena mengirim `estimasi_selesai_hari: null` secara eksplisit
 * (`JSON.stringify` menyimpan null), sehingga key selalu ada.
 */
class MulaiRequestKontrakTest {

    private val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private fun json(permintaan: MulaiRequest): String =
        moshi.adapter(MulaiRequest::class.java).toJson(permintaan)

    @Test
    fun `hari ini juga tidak mengirim field estimasi sama sekali`() {
        val body = json(MulaiRequest())

        assertEquals("{}", body)
        assertFalse(
            "key tidak boleh muncul: server harus membaca dengan ?? null",
            body.contains("estimasi_selesai_hari"),
        )
    }

    @Test
    fun `beberapa hari mengirim angka`() {
        val body = json(MulaiRequest(estimasiSelesaiHari = 7))

        assertTrue(body.contains("\"estimasi_selesai_hari\":7"))
    }

    @Test
    fun `catatan saja tetap tanpa estimasi`() {
        val body = json(MulaiRequest(catatan = "aspal sudah dipesan"))

        assertTrue(body.contains("catatan"))
        assertFalse(body.contains("estimasi_selesai_hari"))
    }
}
