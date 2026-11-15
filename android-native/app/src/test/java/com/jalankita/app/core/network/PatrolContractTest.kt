package com.jalankita.app.core.network

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga kontrak `GET /api/patrol-schedules/{id}`.
 *
 * Regresi yang dijaga: backend mengirim relasi tim sebagai `survey_tasks`
 * (snake_case, hasil serialize relasi `team.surveyTasks` oleh Laravel), BUKAN
 * `surveyTasks`. Ketika DTO masih memakai `@Json(name = "surveyTasks")`, Moshi
 * diam-diam menghasilkan `null` — daftar sesi patroli kosong dan tombol
 * "Antrekan laporan untuk inspeksi" tidak pernah muncul. Test ini memakai
 * potongan respons produksi asli agar kesalahan yang sama tidak kembali.
 */
class PatrolContractTest {

    private val moshi: Moshi = Moshi.Builder()
        .add(LenientDoubleAdapter())
        .add(KotlinJsonAdapterFactory())
        .build()

    private val json = """
        {
          "data": {
            "id": "01a1dea3-a59c-70dd-9078-ec1ee2ab0259",
            "team_id": "019f554c-4662-70bd-bbf7-2b82c09686ab",
            "hari": ["Kamis", "Jumat", "Sabtu", "Minggu"],
            "kecamatan_list": ["Sidoarjo", "Buduran", "Sedati"],
            "frekuensi": "setiap_minggu",
            "start_date": "2026-11-15",
            "end_date": null,
            "status": "aktif",
            "team": {
              "id": "019f554c-4662-70bd-bbf7-2b82c09686ab",
              "name": "Tim Satgas Pusat",
              "survey_tasks": [
                {
                  "id": "3365e220-92ed-480c-873f-450adad54bfd",
                  "kecamatan": "Sidoarjo",
                  "status": "aktif",
                  "tanggal_patroli": "2026-11-14T17:00:00.000000Z",
                  "reports_count": 2
                },
                {
                  "id": "a2b3c4d5-0000-0000-0000-000000000000",
                  "kecamatan": "Buduran",
                  "status": "aktif",
                  "tanggal_patroli": "2026-11-18T17:00:00.000000Z",
                  "reports_count": 0
                }
              ]
            }
          }
        }
    """.trimIndent()

    @Test
    fun `survey_tasks snake_case terbaca menjadi daftar task`() {
        val parsed = moshi.adapter(PatrolDetailResponse::class.java).fromJson(json)
        assertNotNull("Respons detail tidak boleh null", parsed?.data)

        val tasks = parsed!!.data!!.team?.surveyTasks
        assertNotNull("team.survey_tasks wajib terbaca (bukan null)", tasks)
        assertEquals(2, tasks!!.size)
        assertEquals("Sidoarjo", tasks[0].kecamatan)
        assertEquals("aktif", tasks[0].status)
        assertEquals(2, tasks[0].reportsCount)
    }

    @Test
    fun `semua shift produksi berstatus aktif`() {
        val parsed = moshi.adapter(PatrolDetailResponse::class.java).fromJson(json)
        val tasks = parsed!!.data!!.team!!.surveyTasks!!
        assertTrue(tasks.all { it.status == "aktif" })
    }
}
