package com.jalankita.app.feature.auth

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandBackground
import com.jalankita.app.ui.components.BrandCard
import com.jalankita.app.ui.components.BrandFooter
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.CardHeader
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.PasswordToggle
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography

/**
 * Layar login (universal, multi-role) — semua peran pegawai masuk dari sini.
 * Background + overlay → kartu putih → form. Mendukung multi-role
 * (petugas/supervisor/admin); role 'warga' ditolak (lihat AuthViewModel.login).
 */
@Composable
fun LoginScreen(
    vm: AuthViewModel,
    onNavigateRegister: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showPw by remember { mutableStateOf(false) }

    // Animasi masuk: fade-in + slide-up (0.6s ease-out), meniru CSS frontend.
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val anim by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(durationMillis = 600),
        label = "loginAnim",
    )

    BrandBackground(modifier) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp)
                .graphicsLayer {
                    alpha = anim
                    translationY = (1f - anim) * 24.dp.toPx()
                },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            BrandCard {
                CardHeader(
                    title = "DeltaJalan",
                    subtitle = "Halaman Login \u2014 Dinas PU Bina Marga",
                )

                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 32.dp, end = 32.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    vm.loginError?.let { ErrorBox(it) }

                    // Identifier email ATAU telepon (cermin masuk.tsx — server lookup keduanya).
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FieldLabel("Email atau No. Telepon")
                        BrandTextField(
                            value = vm.email,
                            onValueChange = vm::onEmailChange,
                            placeholder = "nama@email.com atau 08xx",
                            enabled = !vm.loginBusy,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Text,
                                imeAction = ImeAction.Next,
                            ),
                        )
                    }

                    // Field password + toggle mata
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FieldLabel("Kata Sandi")
                        BrandTextField(
                            value = vm.password,
                            onValueChange = vm::onPasswordChange,
                            placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                            enabled = !vm.loginBusy,
                            visualTransformation = if (showPw) {
                                androidx.compose.ui.text.input.VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            trailingContent = {
                                PasswordToggle(visible = showPw, onToggle = { showPw = !showPw })
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(onDone = { vm.login() }),
                        )
                    }

                    Spacer(Modifier.height(0.dp))

                    BrandPrimaryButton(
                        text = "Masuk",
                        icon = AppIcon.Login,
                        loading = vm.loginBusy,
                        loadingText = "Memverifikasi...",
                        onClick = vm::login,
                    )
                }

                Box(Modifier.fillMaxWidth().padding(bottom = 24.dp), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Belum punya akun warga? Daftar",
                        color = BrandBlue,
                        style = DeltaJalanTypography.labelSmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .widthIn(max = 280.dp)
                            .clickable { onNavigateRegister() },
                    )
                }
            }

            BrandFooter()
        }
    }
}
