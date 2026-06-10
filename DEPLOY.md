# 🚀 Deployment Plan: DeltaJalan (JalanKita) ke AWS + Cloudflare

## Arsitektur Overview

```
┌─ User ────────────────────────────────────────────────────┐
│  Browser HP Petugas / Supervisor / Petugas Eksekusi        │
└───────────────────────┬───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│              Cloudflare Workers (Free Tier)                 │
│  TanStack Start SSR — React 19 — Frontend                  │
│  Domain: deltajalan-dev.workers.dev (sementara)            │
└───────────────────────┬───────────────────────────────────┘
                        │ Cloudflare Tunnel (cloudflared)
┌───────────────────────▼───────────────────────────────────┐
│                    AWS EC2 t2.micro (Free Tier)              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │  Nginx Proxy   │  │  Laravel 13    │  │  FastAPI AI  │ │
│  │  → Port 80     │──│  (Port 8080)   │  │  (Port 8000) │ │
│  └────────────────┘  └───────┬────────┘  └──────┬───────┘ │
│                              │                   │         │
│  ┌──────────────────────────▼┐  ┌────────────────▼───────┐ │
│  │  RDS PostgreSQL (Free)    │  │  S3 File Storage       │ │
│  │  db.t2.micro              │  │  (Foto laporan)        │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 📦 Prasyarat

| Item | Status |
|---|---|
| Akun **AWS** (free tier aktif, ~$85 credit) | ✅ |
| Akun **GitHub** (repo: BangkitHaqiAliaffuan/JalanKita) | ✅ |
| Akun **Cloudflare** (daftar gratis di cloudflare.com) | ❌ Perlu dibuat |
| **GitHub Token** (Settings → Developer settings → PAT) | ❌ Perlu dibuat |
| **Cloudflare API Token** | ❌ Perlu dibuat |

---

## ✅ Checklist Persiapan Lokal

### 1. Install Tools

```bash
# Wrangler CLI (deploy frontend ke Cloudflare Workers)
npm install -g wrangler

# Login ke Cloudflare
wrangler login
```

### 2. Build & Test Lokal

```bash
# Frontend
cd Frontend-stable
bun install
bun run build       # Pastikan build sukses
bun run preview     # Test production build lokal

# Laravel
cd backend_POSTGRESQL
composer install
cp .env.example .env
# Edit .env → set DB, APP_KEY, dll
php artisan key:generate
php artisan migrate
php artisan serve --port=8080

# AI Server
cd backend_AI
pip install -r requirements.txt   # atau manual: fastapi ultralytics pillow python-multipart uvicorn opencv-python
python server.py                  # Test di http://localhost:8000/health
```

---

## ☁️ Langkah 1: Deploy Frontend ke Cloudflare Workers

### 1.1 Setup Wrangler

File konfigurasi sudah ada di `Frontend-stable/wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "deltajalan-dev",                  // Ganti sesuai keinginan
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts",
}
```

### 1.2 Deploy

```bash
cd Frontend-stable
bun run build
wrangler deploy
```

**Hasil:** `https://deltajalan-dev.workers.dev` (catat URL ini)

### 1.3 Update Env di Cloudflare

```bash
# Set API URL backend di Cloudflare Workers env
wrangler secret put VITE_API_URL
# → Masukkan URL backend (nanti setelah EC2 siap)
```

---

## ☁️ Langkah 2: Setup AWS EC2 (Laravel + FastAPI)

### 2.1 Launch EC2 Instance

1. Buka **AWS Console → EC2 → Launch Instance**
2. Konfigurasi:

| Setting | Pilih |
|---|---|
| Name | `DeltaJalan-Backend` |
| AMI | **Ubuntu 24.04 LTS** (Free tier eligible) |
| Instance type | **t2.micro** (1 vCPU, 1GB RAM) |
| Key pair | Buat baru: `deltajalan-key.pem` (simpan aman) |
| Network | Default VPC |
| Storage | 30GB gp3 (default free tier 30GB) |

3. **Security Group — buat dengan aturan:**

| Type | Protocol | Port | Source | Keterangan |
|---|---|---|---|---|
| SSH | TCP | 22 | IP rumah/kost kamu | Admin akses |
| Custom TCP | TCP | 8080 | Cloudflare IPs only | Laravel |
| Custom TCP | TCP | 8000 | Cloudflare IPs only | FastAPI |
| HTTP | TCP | 80 | Cloudflare IPs only | Nginx |

> **Cloudflare IP ranges:** https://www.cloudflare.com/ips/v4

### 2.2 Connect ke EC2

```bash
chmod 400 deltajalan-key.pem
ssh -i deltajalan-key.pem ubuntu@<EC2-PUBLIC-IP>
```

### 2.3 Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# PHP 8.3 + extensions
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt install -y php8.3-fpm php8.3-cli php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-pgsql php8.3-zip \
  php8.3-bcmath php8.3-gd php8.3-intl php8.3-soap

# Composer
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm composer-setup.php

# Nginx
sudo apt install -y nginx

# Python + pip
sudo apt install -y python3 python3-pip python3-venv

# PostgreSQL client (DB di RDS)
sudo apt install -y postgresql-client

# Node.js (untuk Laravel Vite)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Git
sudo apt install -y git
```

### 2.4 Clone Project

```bash
cd /home/ubuntu
git clone https://github.com/BangkitHaqiAliaffuan/JalanKita.git
cd JalanKita
```

### 2.5 Setup Laravel

```bash
cd /home/ubuntu/JalanKita/backend_POSTGRESQL

# Buat .env dari template
cp .env.example .env
nano .env
```

Isi `.env` minimal:

```env
APP_NAME=DeltaJalan
APP_ENV=production
APP_DEBUG=false
APP_URL=https://deltajalan-dev.workers.dev
APP_KEY=   # ← nanti digenerate

DB_CONNECTION=pgsql
DB_HOST=<RDS-ENDPOINT>      # Isi setelah RDS jadi
DB_PORT=5432
DB_DATABASE=deltajalan
DB_USERNAME=postgres
DB_PASSWORD=<password-kuat>

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=<dari-IAM>
AWS_SECRET_ACCESS_KEY=<dari-IAM>
AWS_DEFAULT_REGION=ap-southeast-1
AWS_BUCKET=deltajalan-photos

FASTAPI_URL=http://localhost:8000

# CORS
FRONTEND_URL=https://deltajalan-dev.workers.dev

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database
```

```bash
composer install --optimize-autoloader --no-dev
php artisan key:generate
sudo chmod -R 775 storage bootstrap/cache
php artisan storage:link
```

### 2.6 Setup Nginx

Buat `/etc/nginx/sites-available/deltajalan`:

```nginx
server {
    listen 80;
    server_name _;

    root /home/ubuntu/JalanKita/backend_POSTGRESQL/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location /api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location /storage {
        alias /home/ubuntu/JalanKita/backend_POSTGRESQL/storage/app/public;
    }

    location ~ /\.ht {
        deny all;
    }

    client_max_body_size 20M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/deltajalan /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 2.7 Setup FastAPI AI Server

Buat virtual environment:

```bash
python3 -m venv /home/ubuntu/ai-env
source /home/ubuntu/ai-env/bin/activate
pip install fastapi ultralytics pillow python-multipart uvicorn opencv-python
```

Buat systemd service `/etc/systemd/system/deltajalan-ai.service`:

```ini
[Unit]
Description=DeltaJalan AI Server (FastAPI + YOLOv8s)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/JalanKita/backend_AI
Environment=FRONTEND_URL=https://deltajalan-dev.workers.dev
Environment=PATH=/home/ubuntu/ai-env/bin:/usr/bin
ExecStart=/home/ubuntu/ai-env/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable deltajalan-ai
sudo systemctl start deltajalan-ai
sudo systemctl status deltajalan-ai

# Test
curl http://localhost:8000/health
# → Harusnya: {"status":"ok","model":"YOLOv8s JalanKita 4-kelas",...}
```

### 2.8 Setup Cloudflare Tunnel

Cloudflare Tunnel membuat EC2 tidak perlu IP publik terbuka.

```bash
# Di laptop lokal
wrangler tunnel login
wrangler tunnel create deltajalan-tunnel
# → Dapatkan Tunnel ID + file credentials.json
```

```bash
# Upload credentials ke EC2
scp -i deltajalan-key.pem ~/.cloudflared/<tunnel-id>.json ubuntu@<EC2-IP>:~

# Di EC2
sudo mkdir -p /etc/cloudflared
sudo mv <tunnel-id>.json /etc/cloudflared/

# Install cloudflared
sudo dpkg -i cloudflared.deb  # atau download dari github

# Test tunnel
sudo cloudflared tunnel run deltajalan-tunnel

# Setup sebagai service
sudo cloudflared service install
```

**Konfigurasi Tunnel** (`~/.cloudflared/config.yml`):

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json
ingress:
  - hostname: api-dev.deltajalan.workers.dev
    service: http://localhost:80
  - service: http_status:404
```

**DNS:** Tambahkan CNAME `api-dev` → tunnel di Cloudflare Dashboard.

---

## ☁️ Langkah 3: Setup AWS RDS PostgreSQL

### 3.1 Create Database

1. **AWS Console → RDS → Create Database**
2. Konfigurasi:

| Setting | Pilih |
|---|---|
| Engine | **PostgreSQL 16** |
| Template | **Free tier** |
| DB instance | **db.t2.micro** |
| Storage | 20GB gp2 |
| DB name | `deltajalan` |
| Master user | `postgres` |
| Password | Buat kuat |
| Public access | **No** (hanya dari VPC) |
| Security group | Allow port 5432 dari EC2 security group |

### 3.2 Migrate Database

```bash
# Update .env Laravel dengan RDS endpoint
nano /home/ubuntu/JalanKita/backend_POSTGRESQL/.env
# → DB_HOST=<rds-endpoint>

# Jalankan migration
cd /home/ubuntu/JalanKita/backend_POSTGRESQL
php artisan migrate --force

# Seed data (user akun test)
php artisan db:seed --class=UserSeeder --force
```

### 3.3 Setup Backup

RDS sudah auto backup (retensi 7 hari) — default sudah aman.

---

## ☁️ Langkah 4: Setup S3 untuk File Storage

### 4.1 Create Bucket

```bash
# Pakai AWS CLI di laptop
aws s3api create-bucket \
  --bucket deltajalan-photos \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

# Blokir public access
aws s3api put-public-access-block \
  --bucket deltajalan-photos \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 4.2 Create IAM User

1. **AWS Console → IAM → Users → Create user** → `deltajalan-s3`
2. Attach policy inline:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::deltajalan-photos",
        "arn:aws:s3:::deltajalan-photos/*"
      ]
    }
  ]
}
```

3. Buat Access Key, masukkan ke `.env` Laravel (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

---

## ☁️ Langkah 5: Finalisasi & Verifikasi

### 5.1 Set Production Laravel

```bash
cd /home/ubuntu/JalanKita/backend_POSTGRESQL

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

sudo systemctl reload nginx
```

### 5.2 Verifikasi Endpoint

```bash
# Test API via tunnel
curl http://localhost/api/health
curl http://localhost/api/auth/login -X POST -d "email=petugas@test.com&password=password"

# Test AI Server
curl http://localhost:8000/health
```

### 5.3 Setup Cloudflare DNS

Di Cloudflare Dashboard:
1. **Workers & Routes → deltajalan-dev** → Route: `deltajalan-dev.workers.dev/*`
2. **DNS → Tambahkan** CNAME `api-dev` → `<tunnel-id>.cfargotunnel.com`

### 5.4 Update CORS

Di EC2, pastikan file-frontend mengirim request ke URL yang benar:

`backend_POSTGRESQL/config/cors.php`:
```php
'allowed_origins' => [
    'https://deltajalan-dev.workers.dev',
    env('FRONTEND_URL'),
],
```

Restart service:
```bash
php artisan config:cache
sudo systemctl reload nginx
```

---

## 🔄 CI/CD: Auto Deploy dengan GitHub Actions

### 6.1 Repository Secrets

Buka **GitHub → Settings → Secrets and variables → Actions**, tambah:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Dari Cloudflare dashboard |
| `EC2_SSH_KEY` | Isi file `deltajalan-key.pem` |
| `EC2_HOST` | IP atau host EC2 |
| `EC2_USER` | `ubuntu` |

### 6.2 Workflow Frontend

Buat `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to Cloudflare Workers

on:
  push:
    branches: [main]
    paths:
      - "Frontend-stable/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: Frontend-stable

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - run: bun install

      - run: bun run build

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: Frontend-stable
          command: deploy
```

### 6.3 Workflow Backend

Buat `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - "backend_POSTGRESQL/**"
      - "backend_AI/**"

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/JalanKita
            git pull

            # Laravel
            cd backend_POSTGRESQL
            composer install --optimize-autoloader --no-dev
            php artisan migrate --force
            php artisan config:cache
            php artisan route:cache
            sudo systemctl reload nginx

            # AI Server
            sudo systemctl restart deltajalan-ai
```

---

## ✅ Final Checklist Deploy

### Sebelum
- [ ] GitHub repo latest di-push
- [ ] Cloudflare akun siap
- [ ] AWS akun bisa akses, free tier belum habis

### Infrastruktur
- [ ] EC2 t2.micro running (Ubuntu 24.04)
- [ ] RDS PostgreSQL running (db.t2.micro)
- [ ] S3 bucket `deltajalan-photos` created
- [ ] IAM user + policy S3
- [ ] Cloudflare Tunnel terpasang & routing

### Aplikasi
- [ ] `wrangler deploy` → frontend bisa diakses
- [ ] Laravel: migration sukses, seed data
- [ ] AI Server: `curl /health` → `{"status":"ok"}`
- [ ] Nginx: running, proxy ke Laravel
- [ ] CORS: konfigurasi domain frontend

### Verifikasi Manual
- [ ] Buka `https://deltajalan-dev.workers.dev` → halaman login
- [ ] Login dengan akun test (lihat `docs/akun-user.md`)
- [ ] Upload foto → AI menganalisis
- [ ] Report masuk ke database
- [ ] Foto tersimpan di S3

---

## 📊 Estimasi Biaya Bulanan

| Service | Biaya | Catatan |
|---|---|---|
| Cloudflare Workers | **Gratis** | 100k req/hari, 1GB bandwidth |
| EC2 t2.micro | **Gratis** (12 bln) | 750 jam/bln |
| RDS db.t2.micro | **Gratis** (12 bln) | 750 jam/bln, 20GB storage |
| S3 | **Gratis** (5GB) | Foto + backup |
| Data transfer Cloudflare | **Gratis** | Workers → EC2 via tunnel |
| Domain (nanti) | ~$10/thn | .go.id atau .com murah |
| **Total** | **~$0/bln** | Selama free tier 12 bln |

$85 AWS credit = buffer untuk S3 storage overage + training SageMaker.

---

## ⚠️ Catatan Penting

| Issue | Solusi |
|---|---|
| **best.pt (85MB)** | Di-track normal. GitHub limit 100MB. Warning saja. |
| **EC2 RAM 1GB** | Cukup untuk Laravel + FastAPI. Jangan jalanin queue worker paralel. |
| **FastAPI di CPU** | YOLOv8s ~3-5 detik/gambar. Wajar untuk internal. |
| **Cold start Workers** | Cloudflare Workers near-instant. Tidak masalah. |
| **Backup DB** | RDS auto backup 7 hari. Bisa ditambah ke S3. |
| **SSL** | Cloudflare provide SSL gratis. |
| **PSE** | Untuk .go.id, daftarkan sebagai PSE Lingkup Publik di Kemenkomdigi. |

---

## 🔄 Workflow Development

```
Edit lokal → git commit + push → GitHub Actions →
  ├─ Frontend: wrangler deploy (Cloudflare Workers)
  └─ Backend: SSH → git pull → migrate → restart nginx/AI
```
