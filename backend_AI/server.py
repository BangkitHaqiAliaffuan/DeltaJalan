from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image, ImageOps
import io, base64, cv2, numpy as np, os
from pathlib import Path

app = FastAPI(title="JalanKita API", version="1.0.0")

# CORS — izinkan frontend dev server (port 8080, 5173, 3000)
app.add_middleware(
    CORSMiddleware,
    # Jangan gunakan wildcard "*" di production — hanya origin yang dikenal.
    # Tambahkan FRONTEND_URL dan NGROK_URL dari environment variable.
    allow_origins=[
        origin for origin in [
            "null",  # untuk file:// protocol (buka HTML langsung)
            "http://localhost:8080",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:5173",
            os.environ.get("FRONTEND_URL", ""),
            os.environ.get("NGROK_URL", ""),
        ] if origin  # filter out empty string
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model — cari best.pt di folder yang sama dengan server.py
MODEL_PATH = Path(__file__).parent / "best.pt"
if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model tidak ditemukan: {MODEL_PATH}")

print(f"Loading model dari: {MODEL_PATH}")
model = YOLO(str(MODEL_PATH))
print("✅ Model berhasil dimuat!")

# Mapping kelas dan severity
CLASS_LABELS = {
    0: "Lubang Besar",
    1: "Lubang Kecil",
    2: "Retak Kulit Buaya",
    3: "Retak Memanjang",
}

SEVERITY_MAP = {
    "Lubang Besar":      "Rusak Berat",
    "Lubang Kecil":      "Rusak Sedang",
    "Retak Kulit Buaya": "Rusak Sedang",
    "Retak Memanjang":   "Rusak Ringan",
}

# Warna bounding box per kelas (BGR untuk OpenCV)
BOX_COLORS = {
    0: (0,   80,  200),   # Lubang Besar      — biru tua
    1: (200, 160,   0),   # Lubang Kecil      — biru muda
    2: (0,  120,  200),   # Retak Kulit Buaya — oranye
    3: (160,  0,  160),   # Retak Memanjang   — ungu
}

SEVERITY_RANK = {"Baik": 0, "Rusak Ringan": 1, "Rusak Sedang": 2, "Rusak Berat": 3}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "YOLOv8s JalanKita 4-kelas",
        "classes": list(CLASS_LABELS.values()),
        "model_path": str(MODEL_PATH),
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    # Baca dan validasi file
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img = ImageOps.exif_transpose(img)
        if img is None:
            return JSONResponse({"status": "error", "message": "Gagal memproses orientasi gambar"}, status_code=400)
    except Exception:
        return JSONResponse({"status": "error", "message": "File bukan gambar yang valid"}, status_code=400)

    # Jalankan inferensi
    results = model.predict(source=img, conf=0.5, iou=0.5, verbose=False)

    # Gambar dengan bounding box
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    h_img, w_img = img_cv.shape[:2]
    line_w = max(4, int(min(w_img, h_img) * 0.003))
    label_scale = max(0.55, round(min(w_img, h_img) * 0.0004, 2))
    label_th = max(1, int(min(w_img, h_img) * 0.0008))
    detections = []

    for r in results:
        for box in r.boxes:
            cid  = int(box.cls[0])
            conf = float(box.conf[0])
            name = CLASS_LABELS.get(cid, "Unknown")
            sev  = SEVERITY_MAP.get(name, "Rusak Ringan")
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            color = BOX_COLORS.get(cid, (100, 100, 100))

            # Gambar bounding box
            cv2.rectangle(img_cv, (x1, y1), (x2, y2), color, line_w)

            # Label background + teks
            label = f"{name} {conf:.0%}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, label_scale, label_th)
            cv2.rectangle(img_cv, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
            cv2.putText(img_cv, label, (x1 + 4, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, label_scale, (255, 255, 255), label_th, cv2.LINE_AA)

            # Hitung area piksel
            area_px = (x2 - x1) * (y2 - y1)

            detections.append({
                "class":        name,
                "severity":     sev,
                "confidence":   round(conf, 3),
                "confidence_pct": f"{conf:.0%}",
                "bbox":         {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "area_px":      area_px,
            })

    # Encode gambar hasil ke base64
    _, buf = cv2.imencode(".jpg", img_cv, [cv2.IMWRITE_JPEG_QUALITY, 90])
    img_b64 = base64.b64encode(buf).decode()

    # Tentukan overall severity
    if detections:
        worst = max(detections, key=lambda d: SEVERITY_RANK.get(d["severity"], 0))
        overall_severity = worst["severity"]
    else:
        overall_severity = "Baik"

    return JSONResponse({
        "detections":       detections,
        "total":            len(detections),
        "overall_severity": overall_severity,
        "image_result":     img_b64,
        "status":           "success",
    })


# Serve HTML test di root — buka http://localhost:8000 langsung
@app.get("/")
def serve_test_html():
    html_path = Path(__file__).parent / "test_jalankita (1).html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text("utf-8"))
    return HTMLResponse("<h1>JalanKita API</h1><p>test_jalankita.html tidak ditemukan</p>")


if __name__ == "__main__":
    import uvicorn
    print("🚀 JalanKita API Server")
    print(f"   Model  : {MODEL_PATH}")
    print(f"   Docs   : http://localhost:8000/docs")
    print(f"   Health : http://localhost:8000/health")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
