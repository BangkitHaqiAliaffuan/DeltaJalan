package com.jalankita.app.core.network

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson

/**
 * Adapter toleran untuk Double/Double?:
 * Backend Laravel menggunakan cast `decimal:8` pada kolom koordinat (latitude, longitude)
 * sehingga selalu ter-serialize sebagai String JSON (cth. "-7.44208830").
 * Moshi default strict melempar JsonDataException saat parsing String -> Double.
 * Adapter ini membaca baik Token.NUMBER maupun Token.STRING lalu mengonversinya ke Double.
 */
class LenientDoubleAdapter {

    @FromJson
    fun fromJson(reader: JsonReader): Double? {
        return when (reader.peek()) {
            JsonReader.Token.NULL -> reader.nextNull<Double?>()
            JsonReader.Token.NUMBER -> reader.nextDouble()
            JsonReader.Token.STRING -> {
                val raw = reader.nextString().trim()
                raw.toDoubleOrNull()
            }
            else -> {
                reader.skipValue()
                null
            }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: Double?) {
        if (value == null) {
            writer.nullValue()
        } else {
            writer.value(value)
        }
    }
}
