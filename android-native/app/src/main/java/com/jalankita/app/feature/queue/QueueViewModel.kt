package com.jalankita.app.feature.queue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.data.outbox.QueuedSubmission
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Layar "Antrean Kirim": menampilkan kiriman yang belum berhasil dikirim
 * (laporan warga, hasil inspeksi, temuan lapangan) dan memberi pengguna
 * kendali atasnya — kirim sekarang, kirim ulang, atau batalkan.
 *
 * Sebelum ini antrean bersifat *write-only*: aplikasi menulis ke berkas dan
 * pengguna tidak punya cara melihat, mempercayai, atau mengendalikannya.
 */
@HiltViewModel
class QueueViewModel @Inject constructor(
    private val outbox: OutboxRepository,
) : ViewModel() {

    /** Semua kiriman milik pengguna aktif (termasuk yang gagal/kedaluwarsa). */
    val semua: StateFlow<List<QueuedSubmission>> = outbox.snapshot

    init {
        viewModelScope.launch { outbox.refresh() }
    }

    fun segarkan() {
        viewModelScope.launch { outbox.refresh() }
    }

    /** Kirim ulang satu item, atau semua bila [id] null. */
    fun kirimUlang(id: String? = null) {
        viewModelScope.launch { outbox.retryNow(id) }
    }

    fun batalkan(id: String) {
        viewModelScope.launch { outbox.cancel(id) }
    }
}
