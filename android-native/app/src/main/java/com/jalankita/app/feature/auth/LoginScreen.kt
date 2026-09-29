package com.jalankita.app.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

/**
 * Layar login Fase 1 — email/nomor HP + password.
 * Server menerima email ATAU nomor telepon di field `email`
 * (AuthController menormalisasi +62/62/0), jadi satu field cukup.
 */
@Composable
fun LoginScreen(vm: AuthViewModel, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("DeltaJalan", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Masuk sebagai petugas lapangan",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = vm.email,
            onValueChange = vm::onEmailChange,
            label = { Text("Email / nomor HP") },
            singleLine = true,
            enabled = !vm.loginBusy,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = vm.password,
            onValueChange = vm::onPasswordChange,
            label = { Text("Kata sandi") },
            singleLine = true,
            enabled = !vm.loginBusy,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { vm.login() }),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))

        vm.loginError?.let { err ->
            Text(
                err,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }

        Button(
            onClick = vm::login,
            enabled = !vm.loginBusy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (vm.loginBusy) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
            Text(if (vm.loginBusy) "Masuk…" else "Masuk")
        }
    }
}
