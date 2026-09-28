package com.jalankita.app.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Pengganti localStorage `jalankita_token` versi web.
 * Token Sanctum non-expiring — 401 dari server berarti token dicabut → clear + re-login.
 */
@Singleton
class TokenStore @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    val token: Flow<String?> = dataStore.data.map { it[KEY_TOKEN] }

    suspend fun save(token: String) {
        dataStore.edit { it[KEY_TOKEN] = token }
    }

    suspend fun clear() {
        dataStore.edit { it.remove(KEY_TOKEN) }
    }

    companion object {
        private val KEY_TOKEN = stringPreferencesKey("sanctum_token")
    }
}
