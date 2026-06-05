# Cara Menjalankan DeltaJalan AI Server

## Prasyarat
```
pip install fastapi ultralytics pillow python-multipart uvicorn opencv-python
```

## Jalankan Server
```bash
cd "d:\JalanKita\AI Model Jalan Kita"
python server.py
```

Server berjalan di: http://localhost:8000
- Health check : http://localhost:8000/health
- API docs     : http://localhost:8000/docs
- Endpoint AI  : POST http://localhost:8000/analyze

## Jalankan Frontend
```bash
cd "d:\JalanKita\Frontend"
npm run dev
```

Frontend berjalan di: http://localhost:8080

## Alur Penggunaan
1. Jalankan server.py terlebih dahulu
2. Jalankan frontend
3. Buka http://localhost:8080
4. Login → Upload & Analisis → pilih foto → klik "Analisis Sekarang"
5. Hasil deteksi AI tampil di halaman Hasil Deteksi AI
