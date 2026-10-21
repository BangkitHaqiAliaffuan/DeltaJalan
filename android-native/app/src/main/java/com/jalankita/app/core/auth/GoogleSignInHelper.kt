package com.jalankita.app.core.auth

import android.app.Activity
import android.content.Context
import android.content.res.Resources
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.jalankita.app.R

/** Dibatalkan user — bukan error yang perlu ditampilkan. */
class GoogleSignInCancelled : Exception()

/** Kegagalan Google Sign-In yang aman ditampilkan ke user. */
class GoogleSignInException(message: String) : Exception(message)

/**
 * Google Sign-In via Credential Manager.
 *
 * Menghasilkan Google ID token; penukaran ke Firebase ID token dilakukan
 * [com.jalankita.app.core.data.AuthRepository] (backend memverifikasi Firebase).
 */
class GoogleSignInHelper(private val context: Context) {

    private val credentialManager = CredentialManager.create(context)

    suspend fun getIdToken(activity: Activity): String {
        val clientId = try {
            context.getString(R.string.default_web_client_id)
        } catch (_: Resources.NotFoundException) {
            throw GoogleSignInException(
                "Konfigurasi Google Sign-In belum tersedia. Hubungi administrator.",
            )
        }

        if (clientId.isBlank()) {
            throw GoogleSignInException(
                "Konfigurasi Google Sign-In belum tersedia. Hubungi administrator.",
            )
        }

        val googleOption = GetGoogleIdOption.Builder()
            .setServerClientId(clientId)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build()

        val response = try {
            credentialManager.getCredential(activity, request)
        } catch (_: GetCredentialCancellationException) {
            throw GoogleSignInCancelled()
        } catch (_: NoCredentialException) {
            throw GoogleSignInException(
                "Tidak ada akun Google di perangkat. Tambahkan akun Google terlebih dahulu.",
            )
        } catch (_: GetCredentialException) {
            throw GoogleSignInException(
                "Gagal membuka pilihan akun Google. Coba lagi.",
            )
        }

        val credential = response.credential
        if (credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            throw GoogleSignInException("Respons Google tidak dikenali. Coba lagi.")
        }

        return try {
            GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (_: GoogleIdTokenParsingException) {
            throw GoogleSignInException("Gagal membaca token Google. Coba lagi.")
        }
    }
}
