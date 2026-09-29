package com.jalankita.app.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jalankita.app.core.network.UserDto

/**
 * Beranda sementara Fase 1 — bukti sesi hidup + logout.
 * Layar fitur (lapor, peta, tugas, notifikasi) menyusul Fase 2–4.
 */
@Composable
fun HomeScreen(
    user: UserDto,
    vm: AuthViewModel,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Selamat bertugas,", style = MaterialTheme.typography.bodyMedium)
        Text(user.name, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Peran: ${user.roleLabel ?: user.role}")
                user.teamName?.let { Text("Tim: $it") }
                user.email?.let { Text(it) }
                user.phone?.let { Text(it) }
            }
        }
        Spacer(Modifier.height(16.dp))

        Text(
            "Alur lapor & peta hadir di Fase 2–3.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))

        Button(
            onClick = vm::refreshSession,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Muat ulang sesi (uji 401)")
        }
        Spacer(Modifier.height(8.dp))

        OutlinedButton(
            onClick = vm::logout,
            enabled = !vm.logoutBusy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (vm.logoutBusy) "Keluar…" else "Keluar")
        }
    }
}
