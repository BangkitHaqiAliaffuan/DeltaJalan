package com.jalankita.app.core.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import com.jalankita.app.core.network.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReportDownloader @Inject constructor(
    private val api: ApiService,
    @ApplicationContext private val context: Context,
) {
    suspend fun downloadMonthlyReport(
        format: String, // "pdf" atau "excel"
        month: Int,
        year: Int,
    ): Result<File> = withContext(Dispatchers.IO) {
        try {
            val isPdf = format.equals("pdf", ignoreCase = true)
            val ext = if (isPdf) "pdf" else "xlsx"
            val mime = if (isPdf) "application/pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            val responseBody = if (isPdf) {
                api.exportMonthlyPdf(month, year)
            } else {
                api.exportMonthlyExcel(month, year)
            }

            val filename = "Rekap_Laporan_${year}_${month.toString().padStart(2, '0')}.$ext"
            // Gunakan scoped external dir (tidak butuh WRITE_EXTERNAL_STORAGE).
            // FileProvider external-files-path di file_paths.xml mendukung path ini.
            val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: context.filesDir

            val targetFile = File(downloadsDir, filename)

            responseBody.byteStream().use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }

            Result.success(targetFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun openFile(file: File) {
        try {
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file,
            )
            val mime = if (file.extension.equals("pdf", ignoreCase = true)) {
                "application/pdf"
            } else {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            // Jika tidak ada app penampil file, abaikan crash
        }
    }
}
