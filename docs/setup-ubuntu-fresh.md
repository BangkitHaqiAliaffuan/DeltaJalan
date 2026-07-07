# Setup DeltaJalan di Ubuntu Fresh

> **Untuk Ubuntu 26+**: PHP 8.3 tidak tersedia di repositori. Gunakan **Docker** (lihat "Alternatif Docker" di bawah).
> Untuk Ubuntu 24.04 / 22.04: bisa pakai native PHP atau Docker.

## Prasyarat Sistem

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Essential tools
sudo apt install -y git curl wget unzip build-essential software-properties-common

# Docker (wajib untuk Ubuntu 26+)
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Logout & login kembali setelah usermod
```

---

## Alternatif: Docker (untuk Ubuntu 26+)

Lewati section PHP dan PostgreSQL di bawah — semua berjalan di container.

### Setup Docker

```bash
# Build image PHP 8.3 + semua ekstensi
cd ~/DeltaJalan
docker compose build php

# Setup database + dependencies (sekali)
docker compose up -d
docker compose exec php composer install
docker compose exec php php artisan key:generate
docker compose exec php php artisan storage:link
docker compose exec php php artisan migrate --seed
```

### Menjalankan Service (setiap dev)

```bash
# Terminal 1: Laravel (port 8080) + PostgreSQL
bash scripts/start-ubuntu.sh

# Terminal 2: Frontend + AI Server
bash scripts/start-dev-ubuntu.sh

# Atau dengan ngrok ke Vite:
bash scripts/start-dev-ubuntu.sh --ngrok
```

### Artisan Commands

```bash
docker compose exec php php artisan <command>
docker compose exec php composer <command>
docker compose exec php php artisan migrate
docker compose exec php php artisan tinker
```

### Docker .env Config

Edit `backend_POSTGRESQL/.env`:
```
DB_HOST=postgres          # nama service docker-compose
DB_PORT=5432
DB_DATABASE=jalankita
DB_USERNAME=jalankita
DB_PASSWORD=jalankita123
FASTAPI_URL=http://host.docker.internal:8000   # akses ke host
```

> **Catatan**: `.env` sudah di-gitignore — aman berbeda tiap OS (Windows vs Ubuntu).

### Docker Commands

```bash
docker compose up -d      # Start containers
docker compose stop       # Stop containers
docker compose down       # Stop + remove containers (data volume aman)
docker compose logs php   # Lihat log Laravel
docker compose logs php -f # Follow log
docker compose restart php # Restart PHP container
```

---

## 1. PHP 8.3 + Extensions (Native — hanya jika tidak pakai Docker)

```bash
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update

sudo apt install -y php8.3 \
  php8.3-cli php8.3-common php8.3-fpm \
  php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-bcmath php8.3-gd \
  php8.3-pgsql php8.3-sqlite3 php8.3-intl \
  php8.3-dom php8.3-fileinfo
```

**Laravel 13 butuh:** ^8.3, mbstring, xml, curl, zip, bcmath, gd, pgsql, sqlite3, intl, dom, fileinfo.

---

## 2. Composer

```bash
cd ~
curl -sS https://getcomposer.org/installer -o composer-setup.php
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm composer-setup.php
composer --version
```

---

## 3. Node.js 22.x + npm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v22.x
npm --version
```

Atau pakai nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

---

## 4. PostgreSQL (Native — skip jika pakai Docker)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Buat database + user
sudo -u postgres psql -c "CREATE USER jalankita WITH PASSWORD 'jalankita123';"
sudo -u postgres psql -c "CREATE DATABASE jalankita OWNER jalankita;"
```

---

## 5. Python + AI Dependencies

```bash
sudo apt install -y python3 python3-pip python3-venv

# Di direktori backend_AI/
cd backend_AI
python3 -m venv venv
source venv/bin/activate
pip install fastapi ultralytics pillow python-multipart uvicorn opencv-python
```

---

## 6. Lainnya

### Redis (optional, untuk queue)

```bash
sudo apt install -y redis-server
sudo systemctl start redis
```

### ngrok (tunnel)

```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install -y ngrok
ngrok config add-authtoken <TOKEN_ANDA>
```

---

## 7. Clone Project & Setup

```bash
git clone <url-repo> ~/DeltaJalan
cd ~/DeltaJalan
```

### Setup Laravel

```bash
cd backend_POSTGRESQL
cp .env.example .env
# EDIT .env — ubah:
#   DB_CONNECTION=pgsql
#   DB_HOST=127.0.0.1
#   DB_PORT=5432
#   DB_DATABASE=jalankita
#   DB_USERNAME=jalankita
#   DB_PASSWORD=jalankita123
#   APP_URL=http://localhost:5173

composer install
php artisan key:generate
php artisan storage:link
php artisan migrate --seed
```

### Setup Frontend

```bash
cd ../Frontend-stable
npm install
# copy .env.example jika ada, atau buat manual:
# VITE_API_BASE_URL=http://localhost:8080
```

### Setup AI Server

```bash
cd ../backend_AI
python3 -m venv venv
source venv/bin/activate
pip install fastapi ultralytics pillow python-multipart uvicorn opencv-python
```

---

## 8. Menjalankan Semua Service

### Terminal 1: Laravel (port 8080)

```bash
cd ~/DeltaJalan/backend_POSTGRESQL
php artisan serve --port=8080
```

### Terminal 2: Frontend Vite (port 5173)

```bash
cd ~/DeltaJalan/Frontend-stable
npm run dev
```

### Terminal 3: AI Server (port 8000)

```bash
cd ~/DeltaJalan/backend_AI
source venv/bin/activate
python server.py
```

---

## Perbedaan OS

| Aspek | Windows | Ubuntu (Native) | Ubuntu (Docker) |
|---|---|---|---|
| **PHP** | Native 8.3 | Native 8.3 | **Container** (`php:8.3-cli`) |
| **PostgreSQL** | Manual install | `apt install` | **Container** (postgres:16) |
| **Laravel start** | `php artisan serve` | `php artisan serve` | `docker compose up -d` |
| **Artisan** | `php artisan` | `php artisan` | `docker compose exec php php artisan` |
| **Script utama** | `start-tunnel.ps1` | `start-android.sh` | **`start-ubuntu.sh`** |
| **Script dev** | — | `start-dev-with-ngrok.sh` | **`start-dev-ubuntu.sh`** |
| **ngrok** | Manual download | `apt install` | `apt install` |
| **Shell scripts** | PowerShell / Git Bash | Native bash | Native bash |

### Yang TIDAK perlu di Ubuntu (Docker):

- Install PHP 8.3 native — semua di container
- Install PostgreSQL native — di container
- Khawatir konflik dengan Windows — `.env` dan script terpisah per OS

### Yang TIDAK perlu di Ubuntu (Native):

- Route fallback `/storage/{path}` di `routes/web.php` — symlink jalan normal di Linux
- PowerShell scripts — pakai `.sh`
- Workaround PHP built-in server 403 — tidak ada issue ini di Linux

---

## Troubleshooting Umum

### `composer install` error karena extension PHP

```bash
# Cek extension yang aktif
php -m

# Install yang kurang
sudo apt install -y php8.3-{nama_extension}
```

### PostgreSQL connection refused

```bash
sudo systemctl status postgresql
# Edit pg_hba.conf untuk allow password auth:
# sudo nano /etc/postgresql/16/main/pg_hba.conf
# Ubah "peer" jadi "md5" untuk local
sudo systemctl restart postgresql
```

### Permission storage

```bash
cd ~/DeltaJalan/backend_POSTGRESQL
sudo chmod -R 775 storage bootstrap/cache
sudo chown -R $USER:www-data storage bootstrap/cache
```

### Port already in use

```bash
# Cek apa yang pakai port
sudo lsof -i :8080
sudo lsof -i :5173
sudo lsof -i :8000

# Kill process
kill -9 <PID>
```

### Vite error `EACCES: permission denied`

Node.js melalui nvm — tidak ada issue permission. Jika pakai system Node, jangan `sudo npm install`.

### Docker: Container PHP crash loop

```bash
# Cek log
docker compose logs php

# Build ulang image (jika ada perubahan Dockerfile)
docker compose build php

# Reset container
docker compose down -v   # HATI-HATI: -v hapus volume data PostgreSQL!
docker compose up -d
```

### Docker: Port 8080 / 5432 already in use

```bash
# Cek proses yang pakai port
sudo lsof -i :8080
sudo lsof -i :5432

# Kill atau stop service lain
sudo systemctl stop postgresql        # jika PostgreSQL native berjalan
# atau stop container lain yang pakai port sama
```

### Docker: Permission denied write storage

```bash
# Pastikan direktori storage writable
chmod -R 775 backend_POSTGRESQL/storage
# Atau jalankan artisan dari dalam container
docker compose exec php php artisan storage:link
```

### Docker: host.docker.internal not resolving (Linux)

`extra_hosts` sudah dikonfigurasi di `docker-compose.yml`. Jika tetap error:

```bash
# Test koneksi ke host dari dalam container
docker compose exec php curl http://host.docker.internal:8000/health
```
