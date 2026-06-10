from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image, ImageOps
import io
import base64
import cv2
import numpy as np
import os
import hashlib
import time
from pathlib import Path

app = FastAPI(title="JalanKita API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins untuk testing
    allow_credentials=False,  # Harus False jika allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "best.pt"
if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model tidak ditemukan: {MODEL_PATH}")

print(f"Loading model dari: {MODEL_PATH}")
model = YOLO(str(MODEL_PATH))
print("Model berhasil dimuat!")

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

BOX_COLORS = {
    0: (0,   80,  200),
    1: (200, 160,   0),
    2: (0,  120,  200),
    3: (160,  0,  160),
}

SEVERITY_RANK = {"Baik": 0, "Rusak Ringan": 1, "Rusak Sedang": 2, "Rusak Berat": 3}

# SHA-256 result cache — TTL 1 jam
INFERENCE_CACHE = {}
CACHE_TTL = 3600

def _compute_sha256(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()

def _draw_detections(img_cv: np.ndarray, results) -> str:
    """Draw bounding boxes and return base64-encoded JPEG."""
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

            cv2.rectangle(img_cv, (x1, y1), (x2, y2), color, line_w)

            label = f"{name} {conf:.0%}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, label_scale, label_th)
            cv2.rectangle(img_cv, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
            cv2.putText(img_cv, label, (x1 + 4, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, label_scale, (255, 255, 255), label_th, cv2.LINE_AA)

            area_px = (x2 - x1) * (y2 - y1)
            detections.append({
                "class":        name,
                "severity":     sev,
                "confidence":   round(conf, 3),
                "confidence_pct": f"{conf:.0%}",
                "bbox":         {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "area_px":      area_px,
            })

    _, buf = cv2.imencode(".jpg", img_cv, [cv2.IMWRITE_JPEG_QUALITY, 90])
    img_b64 = base64.b64encode(buf).decode()

    if detections:
        worst = max(detections, key=lambda d: SEVERITY_RANK.get(d["severity"], 0))
        overall_severity = worst["severity"]
    else:
        overall_severity = "Baik"

    return img_b64, detections, overall_severity

@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.1.0",
        "model": "YOLOv8s JalanKita 4-kelas",
        "classes": list(CLASS_LABELS.values()),
        "model_path": str(MODEL_PATH),
    }

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    include_image: bool = Query(True, description="Sertakan base64 image result dalam response"),
):
    contents = await file.read()

    # SHA-256 cache check
    img_hash = _compute_sha256(contents)
    cached = INFERENCE_CACHE.get(img_hash)
    if cached and (time.time() - cached["ts"]) < CACHE_TTL:
        resp = {k: cached[k] for k in ("detections", "total", "overall_severity", "status")}
        if include_image:
            resp["image_result"] = cached["image_result"]
        return JSONResponse(resp)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img = ImageOps.exif_transpose(img)
        # Tambahkan setelah img = ImageOps.exif_transpose(img)
        # Resize gambar besar ke maksimal 1280px agar objek tidak terlalu kecil
        MAX_DIM = 1280
        w, h = img.size
        if max(w, h) > MAX_DIM:
            scale = MAX_DIM / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            if img is None:
               return JSONResponse({"status": "error", "message": "Gagal memproses orientasi gambar"}, status_code=400)
    except Exception:
        return JSONResponse({"status": "error", "message": "File bukan gambar yang valid"}, status_code=400)

    # YOLO handle resize secara internal, bbox dikembalikan ke skala gambar asli
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    results = model.predict(source=img, conf=0.4, iou=0.5, verbose=False)

    img_b64, detections, overall_severity = _draw_detections(img_cv, results)

    # Cache hasil
    cache_entry = {
        "detections": detections,
        "total": len(detections),
        "overall_severity": overall_severity,
        "status": "success",
        "image_result": img_b64,
        "ts": time.time(),
    }
    INFERENCE_CACHE[img_hash] = cache_entry

    resp = {k: cache_entry[k] for k in ("detections", "total", "overall_severity", "status")}
    if include_image:
        resp["image_result"] = img_b64

    return JSONResponse(resp)

@app.get("/")
def serve_test_html():
    html_path = Path(__file__).parent / "test_jalankita (1).html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text("utf-8"))
    return HTMLResponse("<h1>JalanKita API</h1><p>test_jalankita.html tidak ditemukan</p>")

if __name__ == "__main__":
    import uvicorn
    print("JalanKita API Server v1.1.0")
    print(f"   Model  : {MODEL_PATH}")
    print("   Docs   : http://localhost:8000/docs")
    print("   Health : http://localhost:8000/health")
    print(f"   Cache  : SHA-256, TTL {CACHE_TTL}s")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
