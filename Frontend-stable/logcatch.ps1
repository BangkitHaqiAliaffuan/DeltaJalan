param(
  [switch]$Watch,
  [switch]$ErrorsOnly,
  [switch]$Help
)

if ($Help) {
  Write-Host @"
DeltaJalan Log Catcher -- MumuPlayer
=====================================
Usage: .\logcatch.ps1 [options]

Options:
  -ErrorsOnly   Tampilkan cuma error/fatal
  -Watch        Stream live (Ctrl+C to stop)
  -Help         Bantuan ini

Default: dump sekali semua log app (termasuk info/debug)

Cara pakai:
  1. Buka app DeltaJalan di MumuPlayer
  2. Jalankan script sesuai kebutuhan
"@
  exit
}

# Cek koneksi ADB
$connected = adb devices | Select-String "127.0.0.1:7555"
if (-not $connected) {
  Write-Host "[ADB] Menghubungkan ke MumuPlayer..." -ForegroundColor Yellow
  adb connect 127.0.0.1:7555 2>$null
  Start-Sleep -Milliseconds 500
}

# Cari PID app
$appPid = adb -s 127.0.0.1:7555 shell pidof com.jalankita.app 2>$null
if (-not $appPid) {
  Write-Warning "App com.jalankita.app gak jalan! Buka app dulu di emulator."
  exit 1
}

Write-Host "[LOG] PID: $appPid | Mode: $(if ($Watch) {'LIVE'} elseif ($ErrorsOnly) {'ERRORS'} else {'DUMP'})" -ForegroundColor Cyan
Write-Host "[LOG] Ctrl+C untuk berhenti" -ForegroundColor Gray

$baseArgs = @("-s", "127.0.0.1:7555", "logcat", "--pid=$appPid")

if ($ErrorsOnly) {
  # Error/fatal: AndroidRuntime + Capacitor console.error + chromium
  & "adb" @baseArgs "-d" "*:E" "-s" "Capacitor/Console" "AndroidRuntime" "chromium"
} elseif ($Watch) {
  # Stream live dengan filter tag utama
  & "adb" @baseArgs "-s" "Capacitor/Console" "Capacitor" "AndroidRuntime" "SystemWebView" "chromium"
} else {
  # Dump sekali dengan filter lengkap
  Write-Host "--- DUMP $(Get-Date -Format 'HH:mm:ss') ---" -ForegroundColor DarkGray
  & "adb" @baseArgs "-d" "-s" "Capacitor/Console" "Capacitor" "AndroidRuntime" "SystemWebView" "chromium"
  Write-Host "--- SELESAI ---" -ForegroundColor DarkGray
}
