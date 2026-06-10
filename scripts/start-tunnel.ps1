param(
  [switch]$Rebuild
)

$LaravelPort = 8080
$ScriptDir = Split-Path -Parent $PSCommandPath
$BackendDir = Resolve-Path (Join-Path $ScriptDir "..\backend_POSTGRESQL")
$FrontendDir = Resolve-Path (Join-Path $ScriptDir "..\Frontend-stable")
$BackendEnv = Join-Path $BackendDir ".env"
$FrontendEnv = Join-Path $FrontendDir ".env"

$NgrokPid = $null
$LaravelJob = $null
$NgrokUrl = $null
$OldBackendNgrok = $null
$OldFrontendUrl = $null
$AddedFrontendUrl = $false

function Kill-Ngrok {
  $procs = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
  foreach ($p in $procs) {
    Write-Step "~" "Menghentikan ngrok PID $($p.Id)..."
    $p.Kill()
  }
  if ($procs) { Start-Sleep -Seconds 2 }
}

function Write-Step($Icon, $Message) {
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host "$ts $Icon $Message"
}

function Get-NgrokUrl {
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
      $url = $tunnels.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1 -ExpandProperty public_url
      if ($url) { return $url }
    } catch {
      # ngrok belum siap, tunggu
    }
    Start-Sleep -Milliseconds 1000
  }
  return $null
}

function Set-EnvValue($FilePath, $Key, $Value) {
  $lines = Get-Content $FilePath -Encoding UTF8
  $old = $null
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$Key=") {
      $parts = $lines[$i] -split "=", 2
      $old = $parts[1]
      $lines[$i] = "$Key=$Value"
      $lines | Set-Content $FilePath -Encoding UTF8
      return $old
    }
  }
  $lines += "$Key=$Value"
  $lines | Set-Content $FilePath -Encoding UTF8
  return $null
}

function Remove-EnvKey($FilePath, $Key) {
  $lines = Get-Content $FilePath -Encoding UTF8
  $lines = $lines | Where-Object { $_ -notmatch "^$Key=" }
  $lines | Set-Content $FilePath -Encoding UTF8
}

function Start-LaravelServer {
  $job = Start-Job -ScriptBlock {
    param($Dir, $Port)
    Set-Location $Dir
    php artisan serve --host=0.0.0.0 --port=$Port
  } -ArgumentList $BackendDir.FullName, $LaravelPort

  # Poll port sampai benar-benar listen (max 30 detik)
  for ($i = 0; $i -lt 30; $i++) {
    $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port $LaravelPort -WarningAction SilentlyContinue -InformationLevel Quiet 2>$null
    if ($conn) { return $job }
    Start-Sleep -Seconds 1
  }

  # Timeout — cek job error
  $output = Receive-Job $job -ErrorAction SilentlyContinue
  Write-Step "X" "Laravel gagal: $output"
  Stop-Job $job
  Remove-Job $job
  return $null
}

function Start-NgrokTunnel {
  $ngrokPath = (Get-Command ngrok).Source
  $process = Start-Process -FilePath $ngrokPath -ArgumentList "http", $LaravelPort, "--log=stdout" -NoNewWindow -PassThru
  return $process.Id
}

function Stop-Service {
  Write-Step "---" "Menghentikan semua service..."
  if ($NgrokPid) {
    $p = Get-Process -Id $NgrokPid -ErrorAction SilentlyContinue
    if ($p) { $p.Kill() }
    Write-Step " OK" "ngrok dihentikan"
  }
  if ($LaravelJob) {
    Stop-Job $LaravelJob -ErrorAction SilentlyContinue
    Remove-Job $LaravelJob -ErrorAction SilentlyContinue
    Write-Step " OK" "Laravel dihentikan"
  }
  if ($OldBackendNgrok) {
    Set-EnvValue $BackendEnv "NGROK_URL" $OldBackendNgrok
    Write-Step " OK" "NGROK_URL dikembalikan ke $OldBackendNgrok"
  }
  if ($AddedFrontendUrl) {
    Remove-EnvKey $FrontendEnv "VITE_API_BASE_URL"
    Write-Step " OK" "VITE_API_BASE_URL dihapus (tidak ada sebelumnya)"
  } elseif ($OldFrontendUrl) {
    Set-EnvValue $FrontendEnv "VITE_API_BASE_URL" $OldFrontendUrl
    Write-Step " OK" "VITE_API_BASE_URL dikembalikan"
  }
  Write-Step "OK" "Selesai"
}

# === MAIN ===

Write-Step "---" "Membersihkan proses ngrok lama..."
Kill-Ngrok
Write-Host ""

Write-Step "---" "Memeriksa prerequisites..."
$ok = $true
if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
  Write-Step "X" "php tidak ditemukan di PATH"; $ok = $false
}
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  Write-Step "X" "ngrok tidak ditemukan"; $ok = $false
}
if (-not (Test-Path (Join-Path $BackendDir "artisan"))) {
  Write-Step "X" "artisan tidak ditemukan di $BackendDir"; $ok = $false
}
if (-not (Test-Path $BackendEnv)) {
  Write-Step "X" ".env tidak ditemukan di $BackendDir"; $ok = $false
}
if (-not (Test-Path $FrontendEnv)) {
  Write-Step "X" ".env tidak ditemukan di $FrontendDir"; $ok = $false
}
if (-not $ok) {
  pause
  exit 1
}
Write-Step "OK" "Semua prerequisite OK"
Write-Host ""

Write-Step "---" "Menjalankan Laravel di port $LaravelPort..."
$LaravelJob = Start-LaravelServer
if (-not $LaravelJob) {
  pause
  exit 1
}
Write-Step "OK" "Laravel berjalan di http://localhost:$LaravelPort"
Write-Host ""

Write-Step "---" "Menjalankan ngrok tunnel ke port $LaravelPort..."
$NgrokPid = Start-NgrokTunnel
Write-Step "..." "Menunggu ngrok siap (max 30 detik)..."
$NgrokUrl = Get-NgrokUrl
if (-not $NgrokUrl) {
  Write-Step "X" "Gagal mendapatkan ngrok URL"
  Stop-Service
  pause
  exit 1
}
Write-Step "OK" "Ngrok URL: $NgrokUrl"
Write-Host ""

Write-Step "---" "Update backend .env NGROK_URL..."
$OldBackendNgrok = Set-EnvValue $BackendEnv "NGROK_URL" $NgrokUrl
Write-Step "OK" "NGROK_URL = $NgrokUrl"
if ($OldBackendNgrok) {
  Write-Step ".." "Sebelumnya: $OldBackendNgrok"
}
Write-Host ""

$apiUrl = "$NgrokUrl/api"
Write-Step "---" "Update frontend .env VITE_API_BASE_URL..."
$OldFrontendUrl = Set-EnvValue $FrontendEnv "VITE_API_BASE_URL" $apiUrl
if (-not $OldFrontendUrl) { $AddedFrontendUrl = $true }
Write-Step "OK" "VITE_API_BASE_URL = $apiUrl"
Write-Host ""

if ($Rebuild) {
  Write-Step "---" "Build ulang Capacitor app..."
  Push-Location $FrontendDir
  try {
    npm run build:mobile
    if ($LASTEXITCODE -eq 0) {
      Write-Step "OK" "Build berhasil"
    } else {
      Write-Step "W" "Build gagal (exit code: $LASTEXITCODE)"
    }
  } catch {
    Write-Step "W" "Build error: $_"
  }
  Pop-Location
  Write-Host ""
}

Write-Step "OK" "Semua service berjalan!"
Write-Host ""
Write-Host "   Ngrok:      $NgrokUrl"
Write-Host "   Laravel:    http://localhost:$LaravelPort"
Write-Host "   API:        $apiUrl"
Write-Host ""
Write-Host "   Backend CORS auto-update via NGROK_URL di .env"
Write-Host "   Frontend API URL via VITE_API_BASE_URL di .env"

if (-not $Rebuild) {
  Write-Host ""
  Write-Step "?" "Jalankan ulang dengan -Rebuild untuk build otomatis:"
  Write-Host "   powershell -File scripts\start-tunnel.ps1 -Rebuild"
  Write-Host ""
  Write-Step "?" "Atau build manual lalu deploy ke MumuPlayer"
}

Write-Host ""
Write-Step "<<" "Tekan Enter untuk menghentikan semua service..."
Write-Host ""
$null = Read-Host

Stop-Service
