package com.jalankita.app.feature.auth

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandBackground
import com.jalankita.app.ui.components.BrandCard
import com.jalankita.app.ui.components.BrandFooter
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.CardHeader
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldHint
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography

/**
 * Layar verifikasi OTP email — satu layar untuk DUA jalur pendaftaran:
 * daftar manual ([OtpSource.REGISTER]) dan daftar lewat Google ([OtpSource.GOOGLE]).
 * Yang membedakan hanya teks subjudul dan tujuan tombol "batalkan".
 *
 * Akun BELUM ada di titik ini: baris `users` baru lahir setelah kode benar
 * (`POST /api/auth/register/verify`), dan responsnya langsung berisi token
 * Sanctum sehingga pengguna masuk tanpa kembali ke layar Login.
 *
 * Kerangka Compose mengikuti `RegisterScreen.kt` 1:1 — kartu dikunci ke tinggi
 * viewport, HANYA isi form yang scroll, footer di luar kartu.
 */
@Composable
fun OtpScreen(
    state: SessionState.NeedsOtpVerification,
    vm: AuthViewModel,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val anim by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(durationMillis = 600),
        label = "otpAnim",
    )

    val focusManager = LocalFocusManager.current
    val focusRequester = remember { FocusRequester() }
    // Fokus otomatis ke field kode saat layar muncul — pengguna baru saja
    // meninggalkan form daftar dan tinggal mengetik 6 digit.
    LaunchedEffect(state.registrationToken) {
        runCatching { focusRequester.requestFocus() }
    }

    val isGoogle = state.source == OtpSource.GOOGLE

    BrandBackground(modifier) {
        Box(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(16.dp),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        alpha = anim
                        translationY = (1f - anim) * 24.dp.toPx()
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BrandCard(
                    modifier = Modifier
                        .weight(1f)
                        .widthIn(max = 360.dp),
                ) {
                    CardHeader(
                        title = "Verifikasi Email",
                        subtitle = "Masukkan kode 6 digit yang kami kirim ke email Anda",
                        showDivider = true,
                    )

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(start = 32.dp, end = 32.dp, top = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        vm.otpError?.let { ErrorBox(it) }
                        vm.otpInfo?.let { SuccessBox(it) }

                        InfoBox(
                            if (isGoogle) {
                                "Kode dikirim ke email Google Anda. " +
                                    "Akun dibuat setelah kode diverifikasi."
                            } else {
                                "Akun dibuat setelah kode diverifikasi. " +
                                    "Cek juga folder spam bila tidak menemukan emailnya."
                            },
                        )

                        // Email tujuan — hanya informasi, tidak bisa diubah dari sini.
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Kode dikirim ke")
                            Text(
                                text = state.email.ifBlank { "email terdaftar" },
                                style = DeltaJalanTypography.labelMedium,
                                color = BrandBlue,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Kode Verifikasi")
                            BrandTextField(
                                value = vm.otpCode,
                                onValueChange = vm::onOtpCodeChange,
                                placeholder = "______",
                                leadingIcon = AppIcon.Mail,
                                isError = vm.otpError != null,
                                enabled = !vm.otpBusy,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.NumberPassword,
                                    imeAction = ImeAction.Done,
                                ),
                                keyboardActions = KeyboardActions(
                                    onDone = {
                                        focusManager.clearFocus()
                                        vm.verifyOtp()
                                    },
                                ),
                                modifier = Modifier.focusRequester(focusRequester),
                            )
                            FieldHint("Kode berlaku 15 menit sejak dikirim.", AppIcon.Info)
                        }

                        BrandPrimaryButton(
                            text = "Verifikasi",
                            icon = AppIcon.CheckCircle,
                            loading = vm.otpBusy,
                            loadingText = "Memverifikasi...",
                            onClick = {
                                focusManager.clearFocus()
                                vm.verifyOtp()
                            },
                        )

                        // Kirim ulang: tunggu cooldown server (60 dtk) agar tidak
                        // kena OTP_RESEND_COOLDOWN. BrandSecondaryButton tidak punya
                        // parameter `loading`, jadi statusnya lewat `enabled`.
                        BrandSecondaryButton(
                            text = if (vm.otpResendCooldown > 0) {
                                "Kirim ulang dalam ${vm.otpResendCooldown} dtk"
                            } else {
                                "Kirim ulang kode"
                            },
                            icon = AppIcon.Mail,
                            enabled = vm.otpResendCooldown == 0 && !vm.otpBusy,
                            onClick = { vm.resendOtp() },
                        )

                        // `authScreen` di MainActivity.Root tetap REGISTER selama
                        // layar ini tampil, jadi membatalkan jalur daftar manual
                        // mengembalikan user ke FORM DAFTAR, bukan ke Login —
                        // labelnya harus jujur menyebut tujuan sebenarnya.
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Text(
                                text = if (isGoogle) {
                                    "Batalkan dan kembali ke login"
                                } else {
                                    "Batal, isi ulang data pendaftaran"
                                },
                                color = BrandBlue,
                                style = DeltaJalanTypography.labelSmall,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.clickable(enabled = !vm.otpBusy, onClick = onCancel),
                            )
                        }
                    }
                }

                // Footer di luar kartu — BrandFooter sudah menangani teksnya sendiri.
                BrandFooter()
            }
        }
    }
}