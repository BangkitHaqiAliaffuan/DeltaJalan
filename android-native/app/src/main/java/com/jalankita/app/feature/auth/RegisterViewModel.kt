package com.jalankita.app.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.AuthRepository
import com.jalankita.app.core.data.RegisterResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel untuk layar Daftar (registrasi warga).
 * Validasi nama & telepon direplikasi dari Frontend-stable/src/lib/validators.ts.
 */
@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {

    var name by mutableStateOf("")
        private set
    var email by mutableStateOf("")
        private set
    var phone by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var passwordConfirmation by mutableStateOf("")
        private set

    var nameError by mutableStateOf<String?>(null)
        private set
    var phoneError by mutableStateOf<String?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var success by mutableStateOf<String?>(null)
        private set
    var loading by mutableStateOf(false)
        private set

    fun onNameChange(v: String) { name = v; nameError = null; error = null }
    fun onEmailChange(v: String) { email = v; error = null }
    fun onPhoneChange(v: String) { phone = v; phoneError = null; error = null }
    fun onPasswordChange(v: String) { password = v; error = null }
    fun onPasswordConfirmChange(v: String) { passwordConfirmation = v; error = null }

    /** Validasi nama saat blur — replikasi handleNameBlur(). */
    fun validateNameOnBlur() {
        if (name.isBlank()) { nameError = null; return }
        val r = validateNamaLengkap(name)
        if (r.valid) { nameError = null; name = r.normalized } else nameError = r.error
    }

    /** Validasi & normalisasi telepon saat blur — replikasi handlePhoneBlur(). */
    fun validatePhoneOnBlur() {
        if (phone.isBlank()) { phoneError = null; return }
        val r = validateIndonesianPhone(phone)
        if (r.valid) { phoneError = null; phone = r.normalized } else phoneError = r.error
    }

    fun register(onSuccess: () -> Unit) {
        if (loading) return
        error = null
        success = null

        val nameResult = validateNamaLengkap(name)
        if (!nameResult.valid) {
            nameError = nameResult.error
            error = "Perbaiki kesalahan pada form."
            return
        }
        nameError = null

        if (password.length < 8) {
            error = "Kata sandi minimal 8 karakter."
            return
        }
        if (password != passwordConfirmation) {
            error = "Konfirmasi kata sandi tidak cocok."
            return
        }

        val phoneResult = validateIndonesianPhone(phone)
        if (!phoneResult.valid) {
            phoneError = phoneResult.error
            error = "Perbaiki kesalahan pada form."
            return
        }
        phoneError = null

        viewModelScope.launch {
            loading = true
            when (
                val res = auth.register(
                    name = name,
                    email = email,
                    phone = phone,
                    password = password,
                    passwordConfirmation = passwordConfirmation,
                )
            ) {
                is RegisterResult.Success -> {
                    success = "Registrasi berhasil! Silakan login."
                    // Bersihkan form
                    name = ""; email = ""; phone = ""; password = ""; passwordConfirmation = ""
                    // Beri waktu user membaca pesan sukses (2s), lalu kembali ke login.
                    kotlinx.coroutines.delay(2000)
                    onSuccess()
                }
                is RegisterResult.Error -> error = res.message
            }
            loading = false
        }
    }
}

// ── Validator (replikasi Frontend-stable/src/lib/validators.ts) ──────────────

private val PHONE_REGEX = Regex("^(?:\\+62|62|0)8[1-9][0-9]{6,9}$")
private val NAME_REGEX = Regex("^[A-Za-zÀ-ÖØ-öø-ÿ '.-]{2,100}$")

data class ValidationResult(val valid: Boolean, val normalized: String, val error: String?)

fun validateIndonesianPhone(input: String): ValidationResult {
    val cleaned = input.replace(Regex("[\\s\\-().]"), "")
    if (cleaned.isEmpty()) {
        return ValidationResult(false, cleaned, "Nomor telepon tidak boleh kosong.")
    }
    if (!PHONE_REGEX.matches(cleaned)) {
        return ValidationResult(
            false, cleaned,
            "Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx atau +628xxxxxxxxxx.",
        )
    }
    val normalized = when {
        cleaned.startsWith("+62") -> "0" + cleaned.substring(3)
        cleaned.startsWith("62") -> "0" + cleaned.substring(2)
        else -> cleaned
    }
    return ValidationResult(true, normalized, null)
}

fun validateNamaLengkap(input: String): ValidationResult {
    val trimmed = input.trim()
    if (trimmed.isEmpty()) return ValidationResult(false, trimmed, "Nama lengkap tidak boleh kosong.")
    if (trimmed.length < 2) return ValidationResult(false, trimmed, "Nama lengkap minimal 2 karakter.")
    if (trimmed.length > 100) return ValidationResult(false, trimmed, "Nama lengkap maksimal 100 karakter.")
    if (!NAME_REGEX.matches(trimmed)) {
        return ValidationResult(
            false, trimmed,
            "Nama lengkap hanya boleh mengandung huruf, spasi, titik, dan tanda hubung.",
        )
    }
    if (trimmed.first() in " '.-" || trimmed.last() in " '.-") {
        return ValidationResult(
            false, trimmed,
            "Nama lengkap tidak boleh diawali atau diakhiri dengan spasi, titik, atau tanda hubung.",
        )
    }
    if (!Regex("[A-Za-zÀ-ÖØ-öø-ÿ]").containsMatchIn(trimmed)) {
        return ValidationResult(false, trimmed, "Nama lengkap harus mengandung minimal satu huruf.")
    }
    return ValidationResult(true, trimmed, null)
}
