package com.jalankita.app.core.network

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Adapter Moshi untuk `bbox` deteksi AI.
 *
 * **Masalah nyata** (bug `expected BEGIN_ARRAY but was BEGIN_OBJECT at $$.detections[0].bbox`):
 * endpoint `POST /api/analyze` (ReportController::analyze) meneruskan respons FastAPI APA ADANYA,
 * sehingga `bbox` berbentuk **objek** `{x1,y1,x2,y2}` (backend_AI/server.py:513). Sementara
 * endpoint batch (AIController::analyzeBatch) mengubahnya jadi **array** `[x1,y1,x2,y2]`.
 * Dua bentuk dalam satu tipe DTO → parse gagal.
 *
 * **Solusi**: terima KEDUA bentuk saat parse, dan saat serialize tulis **objek**
 * `{x1,y1,x2,y2}` — karena `PciService::coverageDeduction` membaca `$bbox['x1']` (objek).
 * Native menyerialkan ulang detections untuk `ai_raw_output` saat submit; bentuknya harus
 * objek agar PCI tidak jatuh ke 0.
 */
class BboxAdapter {

    @FromJson
    fun fromJson(reader: JsonReader): List<Double>? {
        return when (reader.peek()) {
            JsonReader.Token.NULL -> { reader.nextNull<Any?>(); null }
            JsonReader.Token.BEGIN_ARRAY -> {
                // Format batch: [x1, y1, x2, y2]
                val out = ArrayList<Double>(4)
                reader.beginArray()
                while (reader.hasNext()) out.add(reader.nextDouble())
                reader.endArray()
                out
            }
            JsonReader.Token.BEGIN_OBJECT -> {
                // Format single/FastAPI: {x1,y1,x2,y2}
                var x1 = 0.0; var y1 = 0.0; var x2 = 0.0; var y2 = 0.0
                reader.beginObject()
                while (reader.hasNext()) {
                    when (reader.nextName()) {
                        "x1" -> x1 = reader.nextDouble()
                        "y1" -> y1 = reader.nextDouble()
                        "x2" -> x2 = reader.nextDouble()
                        "y2" -> y2 = reader.nextDouble()
                        else -> reader.skipValue()
                    }
                }
                reader.endObject()
                listOf(x1, y1, x2, y2)
            }
            else -> { reader.skipValue(); null }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: List<Double>?) {
        if (value == null) { writer.nullValue(); return }
        // Selalu tulis sebagai OBJEK — PciService membaca $bbox['x1']..['y2'].
        writer.beginObject()
        writer.name("x1").value(value.getOrElse(0) { 0.0 })
        writer.name("y1").value(value.getOrElse(1) { 0.0 })
        writer.name("x2").value(value.getOrElse(2) { 0.0 })
        writer.name("y2").value(value.getOrElse(3) { 0.0 })
        writer.endObject()
    }
}
