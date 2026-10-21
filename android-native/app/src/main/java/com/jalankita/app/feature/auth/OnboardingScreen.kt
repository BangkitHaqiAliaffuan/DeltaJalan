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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandBackground
import com.jalankita.app.ui.components.BrandCard
import com.jalankita.app.ui.components.BrandFooter
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.CardHeader
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldErrorDetail
import com.jalankita.app.ui.components.FieldHint
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.ui.components.PasswordToggle
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography

/**
 * Onboarding setelah login Google.
 *
 * Akun baru wajib phone + password; akun lama yang belum punya phone hanya
 * diminta phone. Nama/email read-only karena berasal dari klaim Firebase.
 */
@Composable
fun OnboardingScreen(
    vm: AuthViewModel,
    state: SessionState.NeedsOnboarding,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OnboardingContent(
        vm = vm,
        title = if (state.isNewUser) "Lengkapi Pendaftaran" else "Lengkapi Nomor Telepon",
        subtitle = if (state.isNewUser) {
            "Akun Google terhubung. Isi nomor telepon dan kata sandi untuk membuat akun warga."
        } else {
            "Akun Google terhubung. Nomor telepon wajib dilengkapi sebelum melanjutkan."
        },
        name = state.profile.name,
        email = state.profile.email,
        showPassword = state.isNewUser,
        submitLabel = if (state.isNewUser) "Buat Akun" else "Simpan Nomor",
        onSubmit = vm::completeOnboarding,
        onCancel = onCancel,
        modifier = modifier,
    )
}

/** Untuk sesi Sanctum lama (login password) yang belum punya nomor telepon. */
@Composable
fun PhoneRequiredScreen(
    vm: AuthViewModel,
    user: UserDto,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OnboardingContent(
        vm = vm,
        title = "Lengkapi Nomor Telepon",
        subtitle = "Nomor telepon wajib dilengkapi sebelum menggunakan fitur warga.",
        name = user.name,
        email = user.email.orEmpty(),
        showPassword = false,
        submitLabel = "Simpan Nomor",
        onSubmit = vm::completePhone,
        onCancel = onCancel,
        modifier = modifier,
    )
}

@Composable
private fun OnboardingContent(
    vm: AuthViewModel,
    title: String,
    subtitle: String,
    name: String,
    email: String,
    showPassword: Boolean,
    submitLabel: String,
    onSubmit: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showPw by remember { mutableStateOf(false) }
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val anim by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(durationMillis = 600),
        label = "onboardingAnim",
    )

    BrandBackground(modifier) {
        Box(
            Modifier
                .fillMaxSize()
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
                        title = title,
                        subtitle = subtitle,
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
                        vm.onboardingError?.let { ErrorBox(it) }

                        InfoBox(
                            "Nama dan email mengikuti akun Google dan tidak dapat diubah di sini.",
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Nama")
                            BrandTextField(
                                value = name,
                                onValueChange = {},
                                placeholder = "Nama akun Google",
                                leadingIcon = AppIcon.Person,
                                enabled = false,
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Email")
                            BrandTextField(
                                value = email,
                                onValueChange = {},
                                placeholder = "Email akun Google",
                                leadingIcon = AppIcon.Mail,
                                enabled = false,
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("No. Telepon")
                            BrandTextField(
                                value = vm.onboardingPhone,
                                onValueChange = vm::onOnboardingPhoneChange,
                                placeholder = "08xxxxxxxxxx",
                                leadingIcon = AppIcon.Phone,
                                isError = vm.onboardingPhoneError != null,
                                enabled = !vm.onboardingBusy,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Phone,
                                    imeAction = if (showPassword) {
                                        ImeAction.Next
                                    } else {
                                        ImeAction.Done
                                    },
                                ),
                                keyboardActions = KeyboardActions(
                                    onDone = { onSubmit() },
                                ),
                                modifier = Modifier.onFocusChanged {
                                    if (!it.isFocused) vm.validateOnboardingPhoneOnBlur()
                                },
                            )
                            vm.onboardingPhoneError?.let { FieldErrorDetail(it, AppIcon.Error) }
                            FieldHint("Contoh: 081234567890 atau +628****7890", AppIcon.Info)
                        }

                        if (showPassword) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                FieldLabel("Kata Sandi")
                                BrandTextField(
                                    value = vm.onboardingPassword,
                                    onValueChange = vm::onOnboardingPasswordChange,
                                    placeholder = "Minimal 8 karakter",
                                    enabled = !vm.onboardingBusy,
                                    visualTransformation = if (showPw) {
                                        VisualTransformation.None
                                    } else {
                                        PasswordVisualTransformation()
                                    },
                                    trailingContent = {
                                        PasswordToggle(
                                            visible = showPw,
                                            onToggle = { showPw = !showPw },
                                        )
                                    },
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Password,
                                        imeAction = ImeAction.Next,
                                    ),
                                )
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                FieldLabel("Konfirmasi Kata Sandi")
                                BrandTextField(
                                    value = vm.onboardingPasswordConfirmation,
                                    onValueChange = vm::onOnboardingPasswordConfirmChange,
                                    placeholder = "Ulangi kata sandi",
                                    enabled = !vm.onboardingBusy,
                                    visualTransformation = if (showPw) {
                                        VisualTransformation.None
                                    } else {
                                        PasswordVisualTransformation()
                                    },
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Password,
                                        imeAction = ImeAction.Done,
                                    ),
                                    keyboardActions = KeyboardActions(
                                        onDone = { onSubmit() },
                                    ),
                                )
                            }
                        }

                        BrandPrimaryButton(
                            text = submitLabel,
                            icon = AppIcon.CheckCircle,
                            loading = vm.onboardingBusy,
                            loadingText = "Menyimpan...",
                            onClick = onSubmit,
                        )

                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Text(
                                text = "Batalkan dan kembali ke login",
                                color = BrandBlue,
                                style = DeltaJalanTypography.labelSmall,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.clickable { onCancel() },
                            )
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))
                BrandFooter()
            }
        }
    }
}
