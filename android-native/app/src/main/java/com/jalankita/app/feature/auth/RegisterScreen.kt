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
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandBackground
import com.jalankita.app.ui.components.BrandCard
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.CardHeader
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldErrorDetail
import com.jalankita.app.ui.components.FieldHint
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.PasswordToggle
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography

/**
 * Layar Daftar (akun warga) — replikasi struktur 1:1 Frontend-stable/src/routes/daftar.tsx.
 *
 * PENTING (best practice Compose): struktur mengikuti frontend yang MENGUNCI tinggi
 * kartu ke viewport lalu HANYA area form yang scroll:
 *
 *   Box(root, fillMaxSize)                       ← p-4 / 100dvh
 *     ├─ Box tombol Kembali (align TopStart)     ← di luar aliran, tak terpengaruh
 *     └─ Column(fillMaxSize)                     ← tinggi terkunci
 *          ├─ BrandCard(weight(1f))              ← kartu mengisi, BUKAN wrap-content
 *          │    ├─ CardHeader (fixed)            ← header tidak ikut scroll
 *          │    └─ Column(weight(1f).verticalScroll())  ← HANYA form yang scroll
 *          └─ BrandFooter (di bawah kartu)       ← selalu tampak
 *
 * Padanan Tailwind: flex-1 min-h-0 → Modifier.weight(1f); overflow-y-auto → verticalScroll.
 */
@Composable
fun RegisterScreen(
    onNavigateLogin: () -> Unit,
    modifier: Modifier = Modifier,
    vm: RegisterViewModel = viewModel(),
) {
    var showPw by remember { mutableStateOf(false) }
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val anim by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(durationMillis = 600),
        label = "registerAnim",
    )

    BrandBackground(modifier) {
        Box(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        ) {
            // CATATAN: frontend (daftar.tsx L149 `{!isNative && ...}`) sengaja TIDAK
            // menampilkan tombol back di build native — pengguna memakai tombol back
            // sistem. Kita replikasi itu + BackHandler (lihat MainActivity) agar
            // back sistem di layar ini kembali ke login, bukan keluar aplikasi.
            //
            // Kolom utama — tinggi terkunci ke viewport (fillMaxSize), kartu mengisi sisa.
            Column(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        alpha = anim
                        translationY = (1f - anim) * 24.dp.toPx()
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Kartu: weight(1f) → mengisi ruang tersisa, tapi footer tetap kebagian.
                BrandCard(
                    modifier = Modifier
                        .weight(1f)
                        .widthIn(max = 360.dp),
                ) {
                    // Header: ukuran tetap, tidak ikut scroll.
                    CardHeader(
                        title = "Daftar Akun",
                        subtitle = "Buat akun untuk melaporkan kerusakan jalan",
                        showDivider = true,
                    )

                    // Area form: HANYA ini yang scroll. weight(1f) memberi batas tinggi.
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(start = 32.dp, end = 32.dp, top = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        vm.error?.let { ErrorBox(it) }
                        vm.success?.let { SuccessBox(it) }

                        // Nama Lengkap
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Nama Lengkap")
                            BrandTextField(
                                value = vm.name,
                                onValueChange = vm::onNameChange,
                                placeholder = "Nama lengkap",
                                leadingIcon = AppIcon.Person,
                                isError = vm.nameError != null,
                                enabled = !vm.loading,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                                modifier = Modifier.onFocusChanged {
                                    if (!it.isFocused) vm.validateNameOnBlur()
                                },
                            )
                            vm.nameError?.let { FieldErrorDetail(it, AppIcon.Error) }
                        }

                        // Email
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Email")
                            BrandTextField(
                                value = vm.email,
                                onValueChange = vm::onEmailChange,
                                placeholder = "nama@email.com",
                                leadingIcon = AppIcon.Mail,
                                enabled = !vm.loading,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Email,
                                    imeAction = ImeAction.Next,
                                ),
                            )
                        }

                        // No. Telepon
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("No. Telepon")
                            BrandTextField(
                                value = vm.phone,
                                onValueChange = vm::onPhoneChange,
                                placeholder = "08xxxxxxxxxx",
                                leadingIcon = AppIcon.Phone,
                                isError = vm.phoneError != null,
                                enabled = !vm.loading,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Phone,
                                    imeAction = ImeAction.Next,
                                ),
                                modifier = Modifier.onFocusChanged {
                                    if (!it.isFocused) vm.validatePhoneOnBlur()
                                },
                            )
                            vm.phoneError?.let { FieldErrorDetail(it, AppIcon.Error) }
                            FieldHint("Contoh: 081234567890 atau +628****7890", AppIcon.Info)
                        }

                        // Kata Sandi
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Kata Sandi")
                            BrandTextField(
                                value = vm.password,
                                onValueChange = vm::onPasswordChange,
                                placeholder = "Minimal 8 karakter",
                                enabled = !vm.loading,
                                visualTransformation = if (showPw) {
                                    VisualTransformation.None
                                } else {
                                    PasswordVisualTransformation()
                                },
                                trailingContent = {
                                    PasswordToggle(visible = showPw, onToggle = { showPw = !showPw })
                                },
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Next,
                                ),
                            )
                        }

                        // Konfirmasi Kata Sandi
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Konfirmasi Kata Sandi")
                            BrandTextField(
                                value = vm.passwordConfirmation,
                                onValueChange = vm::onPasswordConfirmChange,
                                placeholder = "Ulangi kata sandi",
                                enabled = !vm.loading,
                                visualTransformation = PasswordVisualTransformation(),
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Done,
                                ),
                            )
                        }

                        BrandPrimaryButton(
                            text = "Daftar",
                            icon = AppIcon.PersonAdd,
                            loading = vm.loading,
                            loadingText = "Mendaftarkan...",
                            onClick = { vm.register(onSuccess = onNavigateLogin) },
                        )

                        // Link "Sudah punya akun? Masuk"
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "Sudah punya akun? Masuk",
                                color = BrandBlue,
                                style = DeltaJalanTypography.labelSmall,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.clickable { onNavigateLogin() },
                            )
                        }
                    }
                }

                // Footer — selalu tampak di bawah kartu (bukan ikut scroll).
                Spacer(Modifier.height(24.dp))
                Text(
                    text = "Dinas PU Bina Marga & SDA \u2014 Kab. Sidoarjo",
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.50f),
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                    fontSize = 11.sp,
                    letterSpacing = 1.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "\u00A9 2024 DeltaJalan Infrastructure Suite. All Rights Reserved.",
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.30f),
                    fontSize = 10.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
