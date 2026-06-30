# Deployment Plan: AWS Hybrid + GitHub Actions CI/CD

> **DeltaJalan (JalanKita)** — 3 layanan: Frontend TanStack Start SSR, Backend Laravel 13, AI FastAPI YOLOv8s.
> **Target:** Dinas PU Bina Marga Kabupaten Sidoarjo.
> **Tanggal:** Juni 2026.

---

## Daftar Isi

1. [Arsitektur](#1-arsitektur)
2. [Prasyarat & Akun](#2-prasyarat--akun)
3. [Phase 1: AI Lambda — WBF Ensemble](#3-phase-1-ai-lambda--wbf-ensemble)
4. [Phase 2: Backend Lightsail](#4-phase-2-backend-lightsail)
5. [Phase 3: Frontend Vercel](#5-phase-3-frontend-vercel)
6. [Phase 4: GitHub Actions CI/CD](#6-phase-4-github-actions-cicd)
7. [Phase 5: Domain & DNS](#7-phase-5-domain--dns)
8. [Phase 6: Monitoring & Maintenance](#8-phase-6-monitoring--maintenance)
9. [Biaya Total](#9-biaya-total)
10. [Risk Register](#10-risk-register)
11. [Urutan Eksekusi](#11-urutan-eksekusi)

---

## 1. Arsitektur

### Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare DNS (Free)                                          │
│  domain → CNAME app.xxx.com → Vercel                            │
│         → A api.xxx.com → Lightsail Static IP                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Vercel Hobby ($0/bln)                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ TanStack Start SSR + Nitro (Node.js 22)                  │   │
│  │ Free: 4 CPU-hrs active, 360 GB-hrs memory, 1M invokes    │   │
│  │ Auto-deploy dari GitHub push (bawaan Vercel)              │   │
│  │ Region: iad1 (US East) — default Vercel Hobby            │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ POST /api/* → api.xxx.com
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│  AWS Lightsail $5/bln (Singapura — ap-southeast-1)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Nginx 1.26 → PHP 8.3-FPM → Laravel 13                   │   │
│  │ PostgreSQL 16 (lokal, unix socket)                       │   │
│  │ Queue Worker (database driver) via Supervisor            │   │
│  │ Scheduler via Cron                                       │   │
│  │ Foto: storage/app/public/ (lokal, 40GB NVMe)             │   │
│  │ ┌─ 1 vCPU · 1GB RAM · 40GB SSD · 2TB transfer ──────┐  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ POST /analyze → Lambda URL
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│  AWS Lambda (Always Free)                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Python 3.12 + ONNX Runtime (CPU)                         │   │
│  │ 2 Model YOLOv8s (best + best_stable) → WBF ensemble      │   │
│  │ Memory: 3008 MB / Timeout: 5 menit / Container: ECR      │   │
│  │ Trigger: Lambda Function URL (HTTPS publik)               │   │
│  │ Free: 1M request + 400.000 GB-detik/bln                  │   │
│  │ Cold start: ~3-6 detik (load 2 model ONNX dari /opt/)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Alur Data

```
1. User buka app.xxx.com → Vercel SSR TanStack Start
2. User submit laporan → Frontend POST /api/reports → Vercel proxy → api.xxx.com (Lightsail)
3. Laravel terima foto → simpan ke storage/app/public/
4. Laravel forward foto ke Lambda URL → POST /analyze
5. Lambda load 2 model ONNX → inference parallel → WBF ensemble → return JSON
6. Laravel simpan hasil deteksi + severity ke PostgreSQL
7. Return response ke frontend
8. Frontend tampilkan hasil ke user
```

### Alur Deploy

```
Developer: git push origin main
                    │
                    ▼
         GitHub menerima push
                    │
         ┌──────────┼──────────────────┐
         ▼          ▼                  ▼
    Vercel      GitHub Actions      GitHub Actions
    auto-       trigger             trigger
    deploy      ├────               ├────
    frontend    │ backend_          │ backend_AI/
                │ POSTGRESQL/       │ lambda/
                │ berubah?          │ berubah?
                ▼                   ▼
            SSH ke Lightsail      Build Docker image
            ├─ git pull           Push ke ECR
            ├─ composer install   Update Lambda function
            ├─ php artisan migrate
            ├─ php artisan cache
            ├─ supervisorctl restart
            └─ systemctl reload php8.3-fpm
```

---

## 2. Prasyarat & Akun

### Daftar Akun (2026)

| Akun | Biaya | Link | Waktu buat | Catatan |
|---|---|---|---|
| **AWS** | $0 (dapat $100-200 credit) | https://aws.amazon.com/free/ | 10 menit | Pilih **Free Plan** saat daftar |
| **Vercel** | $0 | https://vercel.com | 5 menit | Hubungkan GitHub |
| **Cloudflare** | $0 | https://cloudflare.com | 5 menit | Untuk DNS + SSL |
| **GitHub** | $0 | https://github.com | 5 menit | Repo harus **public** agar Actions gratis |
| **Domain** | ~$10-15/tahun | Niagahoster / idwebhost | 1 hari | Contoh: `jalankita.dinas-sidoarjo.go.id` (jika pakai domain go.id gratis) |

### AWS Free Tier 2026 — Hal Penting

Akun dibuat **setelah 15 Juli 2025**:

| Aspek | Detail |
|---|---|
| **Credit** | $100 langsung + $100 dari 5 onboarding tasks = **$200 max** |
| **Masa berlaku** | 6 bulan (Free Plan) atau 12 bulan (Paid Plan) |
| **Free Plan** | Akun auto-close setelah credit habis — **tidak kena tagihan** |
| **Paid Plan** | Credit dipakai dulu, setelah habis tagihan mulai |
| **Always Free** | Lambda (1M req/bln), S3 (5GB), CloudFront (1TB), DynamoDB (25GB) — **tidak pernah kadaluarsa** |
| **Layanan terbatas** | Free Plan tidak bisa akses semua layanan AWS (ada subset) |

> ⚠️ **Tidak ada lagi** EC2/RDS gratis 12 bulan seperti sebelum 2025.

---

## 3. Phase 1: AI Lambda — WBF Ensemble

> **Tujuan:** Ganti FastAPI server (`server.py` yang berjalan di `:8000`) dengan AWS Lambda yang di-trigger via Function URL.
> **Mengapa Lambda?** Always Free (1M request + 400K GB-detik/bln), tidak perlu bayar server idle.

### 3.1 Export Model ke ONNX

ONNX lebih ringan dari PyTorch (.pt) — tanpa `torch` dan `ultralytics` di production.

```bash
# Di lokal (backend_AI/), pastikan ultralytics terinstall
pip install ultralytics onnx onnxruntime

# Export best.pt → best.onnx
python -c "
from ultralytics import YOLO

model = YOLO('best.pt')
model.export(format='onnx', imgsz=640, half=False)
print('best.onnx selesai')

model = YOLO('best_stable.pt')
model.export(format='onnx', imgsz=640, half=False)
print('best_stable.onnx selesai')
"
```

**Hasil:**
| File | Ukuran |
|---|---|
| `best.onnx` | ~25 MB |
| `best_stable.onnx` | ~25 MB |

Pindahkan ke folder Lambda:

```bash
mkdir -p backend_AI/lambda/models
mv best.onnx best_stable.onnx backend_AI/lambda/models/
```

### 3.2 Struktur Folder Lambda

```
backend_AI/lambda/
├── Dockerfile
├── handler.py
├── requirements.txt
├── models/
│   ├── best.onnx           # Model utama
│   └── best_stable.onnx    # Model secondary (remap kelas)
└── template.yaml           # [Opsional] AWS SAM
```

### 3.3 File: `requirements.txt`

```txt
onnxruntime==1.19.2
opencv-python-headless==4.10.0.84
numpy==1.26.4
Pillow==11.1.0
```

Total ukuran setelah install: ~150 MB (ONNX Runtime ~80 MB + OpenCV ~50 MB + lainnya).

### 3.4 File: `Dockerfile`

```dockerfile
# AWS Lambda Python 3.12 base image — 2026
FROM public.ecr.aws/lambda/python:3.12

# Copy model ONNX ke /opt/ (bukan /tmp/, biar tahan antar invoke)
COPY models/ /opt/models/

# Copy handler
COPY handler.py requirements.txt ./

# Install dependensi — minimal, tanpa torch/ultralytics
RUN pip install -r requirements.txt --no-cache-dir

# Entry point Lambda
CMD ["handler.lambda_handler"]
```

**Penjelasan:**
- Model ONNX ditaruh di `/opt/` (bukan `/tmp/`) karena `/opt/` adalah read-only yang di-bundle ke container — model langsung tersedia tanpa download ulang
- Tidak perlu `torch` atau `ultralytics` — cukup `onnxruntime`
- Base image `python:3.12` AWS Lambda sudah include runtime Lambda

### 3.5 File: `handler.py`

File ini adalah port lengkap dari `backend_AI/server.py` ke arsitektur Lambda.

```python
"""
Lambda handler untuk AI inference — WBF ensemble 2 model YOLOv8s.
Port dari server.py (FastAPI) ke AWS Lambda Function URL.

Arsitektur:
1. Lambda menerima request POST dengan file gambar (multipart/form-data)
2. Preprocess gambar ke tensor (640x640, normalize)
3. Inference 2 model ONNX secara sequential (ThreadPoolExecutor parallel)
4. Weighted Boxes Fusion (WBF) untuk menggabungkan deteksi
5. Severity scoring (class-based + count + diversity + confidence)
6. Draw bounding boxes ke gambar
7. Return JSON hasil (deteksi + image base64 + severity)

Dependencies (minimal):
- onnxruntime
- opencv-python-headless
- numpy
- Pillow
"""

import json
import base64
import hashlib
import time
import struct
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps
import cv2


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL SETUP — load ONNX sessions (cold start ~3-6 detik)
# ══════════════════════════════════════════════════════════════════════════════

MODEL_A_PATH = "/opt/models/best.onnx"
MODEL_B_PATH = "/opt/models/best_stable.onnx"

print(f"Loading model A: {MODEL_A_PATH}")
session_a = ort.InferenceSession(MODEL_A_PATH, providers=["CPUExecutionProvider"])
print(f"Loading model B: {MODEL_B_PATH}")
session_b = ort.InferenceSession(MODEL_B_PATH, providers=["CPUExecutionProvider"])
print("Both models loaded successfully.")

# Input tensor name (sama untuk kedua model YOLOv8)
INPUT_NAME = session_a.get_inputs()[0].name

# Class labels
CLASS_LABELS = {
    0: "Lubang",
    1: "Retak Kulit Buaya",
    2: "Retak Memanjang",
    3: "Retak Melintang",
}

SEVERITY_MAP = {
    "Lubang": "Rusak Berat",
    "Retak Kulit Buaya": "Rusak Sedang",
    "Retak Memanjang": "Rusak Ringan",
    "Retak Melintang": "Rusak Ringan",
}

# best_stable → best class remap:
# best_stable: 0=lubang_besar,1=lubang_kecil,2=retak_kulit_buaya,3=retak_memanjang
# best:        0=lubang,       1=retak_buaya,  2=retak_memanjang,   3=retak_melintang
OLD_TO_BEST = {0: 0, 1: 0, 2: 1, 3: 2}

SEVERITY_RANK = {"Baik": 0, "Rusak Ringan": 1, "Rusak Sedang": 2, "Rusak Berat": 3}

SEVERITY_THRESHOLD_BERAT = 2.5
SEVERITY_THRESHOLD_SEDANG = 1.5

SMALL_BBOX_AREA_RATIO = 0.01

BOX_COLORS = {
    0: (0, 80, 200),
    1: (0, 120, 200),
    2: (160, 0, 160),
    3: (200, 160, 0),
}

CONF_THRESHOLD = 0.2
WBF_IOU_THR = 0.5

# SHA-256 cache (in-memory, per execution environment)
INFERENCE_CACHE: dict[str, dict[str, Any]] = {}
CACHE_TTL = 3600


# ══════════════════════════════════════════════════════════════════════════════
#  FUNGSI HELPER
# ══════════════════════════════════════════════════════════════════════════════

def _compute_sha256(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _calculate_iou(box1: list[float], box2: list[float]) -> float:
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def _preprocess(img: Image.Image) -> np.ndarray:
    """Resize + normalize → tensor format NCHW (float32)"""
    img = img.resize((640, 640))
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))  # HWC → CHW
    return np.expand_dims(arr, axis=0)  # → NCHW


def _run_onnx(session: ort.InferenceSession, tensor: np.ndarray) -> list[list[float]]:
    """
    Run ONNX inference, parse output tensor (nx6: x1,y1,x2,y2,conf,cls).
    Output YOLOv8: [1, 84, 8400] → transpose, filter, scale.
    """
    outputs = session.run(None, {INPUT_NAME: tensor})
    predictions = np.squeeze(outputs[0]).T  # (8400, 84)

    # Filter by confidence
    mask = predictions[:, 4] >= CONF_THRESHOLD
    predictions = predictions[mask]

    if len(predictions) == 0:
        return []

    boxes = []
    for pred in predictions:
        xc, yc, w, h = pred[0], pred[1], pred[2], pred[3]
        x1 = int((xc - w / 2) * (640 / 640))  # scale to 640 coords
        y1 = int((yc - h / 2) * (640 / 640))
        x2 = int((xc + w / 2) * (640 / 640))
        y2 = int((yc + h / 2) * (640 / 640))
        conf = float(pred[4])
        cls = int(pred[5:].argmax())
        boxes.append([x1, y1, x2, y2, conf, cls])

    return boxes


def _remap_boxes(boxes: list[list[float]], mapping: dict[int, int]) -> list[list[float]]:
    return [[x1, y1, x2, y2, conf, mapping.get(cls, cls)] for x1, y1, x2, y2, conf, cls in boxes]


def _weighted_boxes_fusion(
    boxes_per_model: list[list[list[float]]],
    conf_type: str = "max",
    iou_thr: float = 0.5,
) -> list[list[float]]:
    """WBF: Weighted Boxes Fusion (pure numpy, tanpa library tambahan)"""
    all_boxes: list[list[float]] = []
    weight = 1.0 / len(boxes_per_model)
    for model_boxes in boxes_per_model:
        for x1, y1, x2, y2, conf, cls in model_boxes:
            all_boxes.append([x1, y1, x2, y2, conf, cls, weight])

    if not all_boxes:
        return []

    all_boxes.sort(key=lambda x: x[4], reverse=True)
    n_models = len(boxes_per_model)

    clusters: list[dict[str, Any]] = []
    for box in all_boxes:
        x1, y1, x2, y2, conf, cls, w = box
        best_iou = iou_thr
        best_idx = -1
        for i, cluster in enumerate(clusters):
            if cluster["cls"] != cls:
                continue
            iou = _calculate_iou([x1, y1, x2, y2], cluster["box"])
            if iou > best_iou:
                best_iou = iou
                best_idx = i

        if best_idx >= 0:
            clusters[best_idx]["boxes"].append(box)
        else:
            clusters.append({"boxes": [box], "box": [x1, y1, x2, y2], "cls": cls})

    result = []
    for cluster in clusters:
        boxes = cluster["boxes"]
        n = len(boxes)

        total_w = sum(b[4] * b[6] for b in boxes)
        if total_w <= 0:
            continue

        x1 = int(sum(b[0] * b[4] * b[6] for b in boxes) / total_w)
        y1 = int(sum(b[1] * b[4] * b[6] for b in boxes) / total_w)
        x2 = int(sum(b[2] * b[4] * b[6] for b in boxes) / total_w)
        y2 = int(sum(b[3] * b[4] * b[6] for b in boxes) / total_w)

        coverage = min(1.0, n / n_models)
        if conf_type == "max":
            final_conf = max(b[4] for b in boxes) * coverage
        else:
            final_conf = (sum(b[4] for b in boxes) / n) * coverage

        cls_votes: dict[int, float] = {}
        for b in boxes:
            cls_votes[b[5]] = cls_votes.get(b[5], 0) + b[4]
        final_cls = max(cls_votes, key=cls_votes.get)

        result.append([x1, y1, x2, y2, final_conf, final_cls])

    result.sort(key=lambda x: x[4], reverse=True)
    return result


def _suppress_contained_boxes(
    detections: list[list[float]],
    containment_ratio: float = 0.7,
) -> list[list[float]]:
    """Suppress boxes that are substantially contained within larger same-class boxes."""
    if not detections:
        return []

    sorted_dets = sorted(
        detections,
        key=lambda b: (b[3] - b[1]) * (b[2] - b[0]),
        reverse=True,
    )

    keep: list[list[float]] = []
    for det in sorted_dets:
        x1, y1, x2, y2, conf, cls = det
        area = (x2 - x1) * (y2 - y1)
        suppressed = False
        for kept in keep:
            kx1, ky1, kx2, ky2, _, kcls = kept
            if cls != kcls:
                continue
            ix1 = max(x1, kx1)
            iy1 = max(y1, ky1)
            ix2 = min(x2, kx2)
            iy2 = min(y2, ky2)
            if ix2 <= ix1 or iy2 <= iy1:
                continue
            inter_area = (ix2 - ix1) * (iy2 - iy1)
            if inter_area / area >= containment_ratio:
                suppressed = True
                break
        if not suppressed:
            keep.append(det)

    return keep


def compute_severity_new(
    detections: list[dict[str, Any]],
    img_w: int,
    img_h: int,
) -> tuple[str, float, dict[str, Any]]:
    """Severity scoring — class-based (invariant to angle/distance)"""
    if not detections:
        return "Baik", 0.0, {}

    n = len(detections)
    classes = [d["class"] for d in detections]
    confs = [d["confidence"] for d in detections]
    avg_conf = sum(confs) / n

    score = 0.0
    details: dict[str, Any] = {}

    has_lubang = "Lubang" in classes
    has_buaya = "Retak Kulit Buaya" in classes
    has_memanjang = "Retak Memanjang" in classes
    has_melintang = "Retak Melintang" in classes
    has_crack = has_memanjang or has_melintang

    if has_lubang and has_buaya:
        score += 2.5
        details["class_base"] = "lubang+buaya(2.5)"
    elif has_lubang:
        score += 1.8
        details["class_base"] = "lubang(1.8)"
    elif has_buaya:
        score += 1.2
        details["class_base"] = "buaya(1.2)"
    elif has_crack:
        score += 0.6
        details["class_base"] = "crack(0.6)"

    count_bonus = 0.0
    if n >= 5:
        count_bonus = 1.0
    elif n >= 3:
        count_bonus = 0.5
    elif n == 1 and score < 1.0:
        count_bonus = -0.2

    if count_bonus:
        score += count_bonus
        details["count_bonus"] = f"{n}det({count_bonus:+.1f})"

    unique_classes = len(set(classes))
    diversity_bonus = 0.0
    if unique_classes >= 3:
        diversity_bonus = 0.5
    elif unique_classes >= 2:
        diversity_bonus = 0.2

    if diversity_bonus:
        score += diversity_bonus
        details["diversity"] = f"{unique_classes}cls({diversity_bonus:+.1f})"

    if avg_conf < 0.12:
        score = max(0.0, score - 0.4)
        details["conf_penalty"] = f"avg_conf={avg_conf:.2f}(-0.4)"
    elif avg_conf < 0.20:
        score = max(0.0, score - 0.2)
        details["conf_penalty"] = f"avg_conf={avg_conf:.2f}(-0.2)"

    max_area_ratio = 0.0
    total_area = 0
    for d in detections:
        b = d["bbox"]
        area = (b["x2"] - b["x1"]) * (b["y2"] - b["y1"])
        total_area += area
        ratio = area / (img_w * img_h)
        if ratio > max_area_ratio:
            max_area_ratio = ratio

    coverage = total_area / (img_w * img_h)
    area_bonus = 0.0

    if max_area_ratio > 0.40:
        area_bonus += 0.5
    elif max_area_ratio > 0.20:
        area_bonus += 0.3

    if coverage > 0.40:
        area_bonus += 0.5
    elif coverage > 0.25:
        area_bonus += 0.3

    if area_bonus:
        score += area_bonus
        details["area"] = f"max={max_area_ratio:.1%} cov={coverage:.1%}(+{area_bonus:.1f})"

    if score >= SEVERITY_THRESHOLD_BERAT:
        severity = "Rusak Berat"
    elif score >= SEVERITY_THRESHOLD_SEDANG:
        severity = "Rusak Sedang"
    else:
        severity = "Rusak Ringan"

    return severity, round(score, 2), details


def _draw_detections(
    img_cv: np.ndarray,
    merged_boxes: list[list[float]],
) -> tuple[str, list[dict[str, Any]], str]:
    """Draw bounding boxes + encode to base64 JPEG."""
    h_img, w_img = img_cv.shape[:2]
    line_w = max(4, int(min(w_img, h_img) * 0.003))
    label_scale = max(0.55, round(min(w_img, h_img) * 0.0004, 2))
    label_th = max(1, int(min(w_img, h_img) * 0.0008))

    detections: list[dict[str, Any]] = []
    for x1, y1, x2, y2, conf, cls in merged_boxes:
        cls = int(cls)
        name = CLASS_LABELS.get(cls, "Unknown")
        sev = SEVERITY_MAP.get(name, "Rusak Ringan")

        area_px = (x2 - x1) * (y2 - y1)
        if cls == 0 and area_px < SMALL_BBOX_AREA_RATIO * w_img * h_img:
            sev = "Rusak Ringan"

        color = BOX_COLORS.get(cls, (100, 100, 100))
        cv2.rectangle(img_cv, (x1, y1), (x2, y2), color, line_w)

        label = f"{name} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, label_scale, label_th)
        cv2.rectangle(img_cv, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
        cv2.putText(
            img_cv, label, (x1 + 4, y1 - 5),
            cv2.FONT_HERSHEY_SIMPLEX, label_scale, (255, 255, 255), label_th, cv2.LINE_AA,
        )

        detections.append({
            "class": name,
            "severity": sev,
            "confidence": round(conf, 3),
            "confidence_pct": f"{conf:.0%}",
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "area_px": area_px,
        })

    _, buf = cv2.imencode(".jpg", img_cv, [cv2.IMWRITE_JPEG_QUALITY, 75])
    img_b64 = base64.b64encode(buf).decode()

    if detections:
        worst = max(detections, key=lambda d: SEVERITY_RANK.get(d["severity"], 0))
        overall_severity = worst["severity"]
    else:
        overall_severity = "Baik"

    return img_b64, detections, overall_severity


# ══════════════════════════════════════════════════════════════════════════════
#  LAMBDA HANDLER — MAIN ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════════

def lambda_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """
    Lambda handler — dipanggil oleh AWS Lambda Function URL.

    Request format:
      POST / HTTP/1.1
      Content-Type: multipart/form-data
      Body: file=<image>

    Atau:
      POST / HTTP/1.1
      Content-Type: application/json
      Body: {"image_base64": "..."}  (dari Laravel batch)
    """
    try:
        # ── Parse input ──────────────────────────────────────────────────
        headers = event.get("headers", {}) or {}
        content_type = headers.get("content-type", headers.get("Content-Type", ""))

        if "application/json" in content_type:
            # JSON body: base64 image
            body = json.loads(event.get("body", "{}"))
            if isinstance(body, str):
                body = json.loads(body)
            image_b64 = body.get("image_base64", body.get("file", ""))
            image_bytes = base64.b64decode(image_b64)
        else:
            # Multipart form-data
            if event.get("isBase64Encoded", False):
                body_bytes = base64.b64decode(event.get("body", ""))
            else:
                body_bytes = (event.get("body") or "").encode()

            # Parse multipart — ambil field 'file'
            import cgi
            import io
            fp = io.BytesIO(body_bytes)
            environ = {"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type}
            fs = cgi.FieldStorage(fp=fp, environ=environ, keep_blank_values=True)

            if "file" in fs:
                image_bytes = fs["file"].file.read()
            else:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"status": "error", "message": "Field 'file' tidak ditemukan"}),
                }

        # ── Cek cache ────────────────────────────────────────────────────
        img_hash = _compute_sha256(image_bytes)
        cached = INFERENCE_CACHE.get(img_hash)
        if cached and (time.time() - cached["ts"]) < CACHE_TTL:
            resp = {k: cached[k] for k in ("detections", "total", "overall_severity", "severity_score", "severity_detail", "status")}
            resp["from_cache"] = True
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(resp),
            }

        # ── Preprocess image ──────────────────────────────────────────────
        try:
            img = Image.open(BytesIO(image_bytes)).convert("RGB")
            img = ImageOps.exif_transpose(img)
        except Exception:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"status": "error", "message": "File bukan gambar yang valid"}),
            }

        img_np = np.array(img)
        h_resized, w_resized = img_np.shape[:2]
        tensor = _preprocess(img)

        # ── Inference 2 model parallel ─────────────────────────────────────
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_a = executor.submit(_run_onnx, session_a, tensor)
            future_b = executor.submit(_run_onnx, session_b, tensor)
            boxes_a = future_a.result()
            boxes_b = future_b.result()

        # Remap kelas best_stable → best
        boxes_b = _remap_boxes(boxes_b, OLD_TO_BEST)

        # ── Ensemble WBF ──────────────────────────────────────────────────
        merged = _weighted_boxes_fusion([boxes_a, boxes_b], conf_type="max", iou_thr=WBF_IOU_THR)
        merged = _suppress_contained_boxes(merged)

        # ── Draw & encode ─────────────────────────────────────────────────
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        img_b64, detections, _ = _draw_detections(img_cv, merged)

        # ── Severity scoring ──────────────────────────────────────────────
        overall_severity, severity_score, severity_detail = compute_severity_new(
            detections, w_resized, h_resized,
        )

        # ── Cache ─────────────────────────────────────────────────────────
        cache_entry = {
            "detections": detections,
            "total": len(detections),
            "overall_severity": overall_severity,
            "severity_score": severity_score,
            "severity_detail": severity_detail,
            "status": "success",
            "image_result": img_b64,
            "ts": time.time(),
        }
        INFERENCE_CACHE[img_hash] = cache_entry

        # ── Response ──────────────────────────────────────────────────────
        resp = {
            k: cache_entry[k]
            for k in ("detections", "total", "overall_severity", "severity_score", "severity_detail", "status")
        }
        resp["image_result"] = img_b64

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(resp),
        }

    except Exception as e:
        print(f"ERROR: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "error", "message": str(e)}),
        }
```

### 3.6 File: `template.yaml` (Opsional — AWS SAM)

Bisa pakai SAM untuk deploy yang lebih terstruktur:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Resources:
  JalanKitaAIFunction:
    Type: AWS::Serverless::Function
    Properties:
      PackageType: Image
      MemorySize: 3008
      Timeout: 300
      FunctionUrlConfig:
        AuthType: NONE
      Policies:
        - AWSLambdaBasicExecutionRole
    Metadata:
      Dockerfile: Dockerfile
      DockerContext: .
      DockerTag: latest

Outputs:
  LambdaURL:
    Description: "Lambda Function URL"
    Value:
      Fn::GetAtt: JalanKitaAIFunctionUrl.FunctionUrl
```

### 3.7 Deploy Lambda

**Metode A — Via AWS CLI (paling sederhana):**

```bash
# Build Docker image
cd backend_AI/lambda
docker build -t jalankita-ai .

# Login ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin <account_id>.dkr.ecr.ap-southeast-1.amazonaws.com

# Buat repository (hanya sekali)
aws ecr create-repository --repository-name jalankita-ai --region ap-southeast-1

# Tag & push
docker tag jalankita-ai:latest <account_id>.dkr.ecr.ap-southeast-1.amazonaws.com/jalankita-ai:latest
docker push <account_id>.dkr.ecr.ap-southeast-1.amazonaws.com/jalankita-ai:latest

# Buat IAM role untuk Lambda (hanya sekali)
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name lambda-jalankita-ai \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name lambda-jalankita-ai \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Buat Lambda function
aws lambda create-function \
  --function-name jalankita-ai \
  --package-type Image \
  --code ImageUri=<account_id>.dkr.ecr.ap-southeast-1.amazonaws.com/jalankita-ai:latest \
  --role arn:aws:iam::<account_id>:role/lambda-jalankita-ai \
  --memory-size 3008 \
  --timeout 300

# Buat Function URL
aws lambda create-function-url-config \
  --function-name jalankita-ai \
  --auth-type NONE

# Dapatkan URL
aws lambda get-function-url-config --function-name jalankita-ai
# Output: https://xxxxx.lambda-url.ap-southeast-1.on.aws/
```

**Metode B — Via SAM (untuk CI/CD):**

```bash
cd backend_AI/lambda
sam build
sam deploy --guided
```

### 3.8 Test Lambda

```bash
# Single image
curl -X POST https://xxxxx.lambda-url.ap-southeast-1.on.aws/ \
  -F "file=@test-foto.jpg" | jq .

# Batch (base64 JSON)
echo '{"image_base64": "'$(base64 -w0 test-foto.jpg)'"}' | \
  curl -X POST https://xxxxx.lambda-url.ap-southeast-1.on.aws/ \
  -H "Content-Type: application/json" -d @- | jq .
```

**Response sukses:**
```json
{
  "status": "success",
  "detections": [
    {"class": "Lubang", "severity": "Rusak Berat", "confidence": 0.873, ...},
    {"class": "Retak Memanjang", "severity": "Rusak Ringan", "confidence": 0.654, ...}
  ],
  "total": 2,
  "overall_severity": "Rusak Berat",
  "severity_score": 2.3,
  "severity_detail": {"class_base": "lubang(1.8)", "count_bonus": "2det(+0.5)"},
  "image_result": "/9j/4AAQ..."
}
```

---

## 4. Phase 2: Backend Lightsail

> **Tujuan:** 1 instance Lightsail ($5/bln) menjalankan Nginx + PHP 8.3 + PostgreSQL 16 + Laravel 13.

### 4.1 Launch Lightsail Instance

1. Login ke **AWS Console** → cari **Lightsail**
2. Klik **Create instance**
3. Pilih:
   - **Region:** `Singapore (ap-southeast-1)` — latensi terendah dari Indonesia
   - **Platform:** Linux/Unix
   - **Blueprint:** OS Only → **Ubuntu 24.04 LTS**
   - **Plan:** **$5/bln** (1 vCPU, 1GB RAM, 40GB SSD, 2TB transfer)
   - **Nama instance:** `jalankita-backend`
4. Klik **Create instance**
5. Setelah jadi:
   - Networking → **Create static IP** → lampirkan ke instance
   - Catat IP (contoh: `13.250.xxx.xxx`)
   - Download SSH key (`LightsailDefaultKey-ap-southeast-1.pem`)

### 4.2 SSH ke Server

```bash
chmod 400 LightsailDefaultKey-ap-southeast-1.pem
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@13.250.xxx.xxx
```

### 4.3 System Update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
```

### 4.4 Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4.5 Install PHP 8.3 + Extensions

```bash
sudo apt install php8.3-fpm php8.3-cli php8.3-common -y
sudo apt install php8.3-curl php8.3-dom php8.3-fileinfo php8.3-gd -y
sudo apt install php8.3-mbstring php8.3-pgsql php8.3-xml php8.3-zip -y
sudo apt install php8.3-bcmath php8.3-intl php8.3-tokenizer php8.3-mysql -y

# Verify
php -v
# Output: PHP 8.3.x

sudo systemctl enable php8.3-fpm
sudo systemctl start php8.3-fpm
```

**Penjelasan ekstensi yang dibutuhkan:**
| Ekstensi | Untuk |
|---|---|
| `curl` | HTTP client (panggil Lambda AI, LocationIQ) |
| `dom` | Dompdf (export PDF laporan) |
| `gd` | Image processing (resize foto) |
| `mbstring` | String multibyte |
| `pgsql` | Koneksi PostgreSQL |
| `xml` | Parsing XML (Spreadsheet, Dompdf) |
| `zip` | PhpSpreadsheet |
| `bcmath` | Presisi numerik |
| `intl` | Lokalisasi (Indonesia) |

### 4.6 Install PostgreSQL 16

```bash
# PostgreSQL 16 sudah di repo default Ubuntu 24.04
sudo apt install postgresql-16 postgresql-contrib-16 -y
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 4.7 Install Composer

```bash
cd /tmp
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php --install-dir=/usr/local/bin --filename=composer
php -r "unlink('composer-setup.php');"
composer --version
```

### 4.8 Install Supervisor

```bash
sudo apt install supervisor -y
sudo systemctl enable supervisor
sudo systemctl start supervisor
```

### 4.9 Install Certbot (SSL)

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 4.10 Clone Repository

```bash
sudo mkdir -p /var/www/jalankita
sudo chown -R ubuntu:ubuntu /var/www/jalankita
cd /var/www/jalankita
git clone https://github.com/<user>/DeltaJalan.git .
```

### 4.11 Setup PostgreSQL Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE jalankita;
CREATE USER jalankita WITH PASSWORD 'GantiDenganPasswordKuat123!';
GRANT ALL PRIVILEGES ON DATABASE jalankita TO jalankita;

-- Beri akses schema public
\c jalankita
GRANT ALL ON SCHEMA public TO jalankita;
GRANT ALL ON ALL TABLES IN SCHEMA public TO jalankita;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO jalankita;

\q
```

### 4.12 Konfigurasi .env Laravel

```bash
cd /var/www/jalankita/backend_POSTGRESQL
cp .env.example .env
nano .env
```

**Isi .env untuk production:**

```ini
APP_NAME=JalanKita
APP_ENV=production
APP_DEBUG=false
APP_KEY=   # Akan di-generate
APP_URL=https://api.jalankita.sidoarjo.go.id

DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=jalankita
DB_USERNAME=jalankita
DB_PASSWORD=GantiDenganPasswordKuat123!

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false

CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=local

FASTAPI_URL=https://xxxxx.lambda-url.ap-southeast-1.on.aws/

LOG_CHANNEL=stack
LOG_LEVEL=warning

FRONTEND_URL=https://app.jalankita.sidoarjo.go.id

# AWS S3 (untuk backup, opsional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=ap-southeast-1
AWS_BUCKET=jalankita-backups
```

**Mengapa pakai `database` driver untuk session/cache/queue?**
- 1GB RAM tidak cukup untuk Redis
- Query PostgreSQL sudah cukup cepat untuk traffic Dinas PU (puluhan user)
- Tidak perlu service tambahan (hemat RAM)

### 4.13 Install Laravel Dependencies

```bash
cd /var/www/jalankita/backend_POSTGRESQL

# Generate APP_KEY
php artisan key:generate

# Install dependencies (production mode — tanpa dev)
composer install --no-dev --optimize-autoloader --no-interaction
```

### 4.14 Migration & Seed

```bash
# Create session table
php artisan session:table

# Run migrations
php artisan migrate --force

# Run seeder (akun default)
php artisan db:seed --force
```

### 4.15 Storage Link

```bash
php artisan storage:link
# Membuat symlink: public/storage → storage/app/public
```

### 4.16 Cache

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Jika ada error, clear dulu:
php artisan config:clear  # HANYA jika error
```

### 4.17 Nginx Virtual Host

```nginx
# /etc/nginx/sites-available/jalankita

server {
    listen 80;
    server_name 13.250.xxx.xxx api.jalankita.sidoarjo.go.id;

    root /var/www/jalankita/backend_POSTGRESQL/public;
    index index.php;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    charset utf-8;

    # Gzip
    gzip on;
    gzip_types application/json text/plain text/css application/javascript image/jpeg image/png;
    gzip_min_length 1000;

    # Logs
    access_log /var/log/nginx/jalankita-access.log;
    error_log  /var/log/nginx/jalankita-error.log;

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2|svg)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Laravel front controller
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_param PATH_INFO $fastcgi_path_info;
    }

    # Deny access to hidden files
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Deny access to storage (kecuali via Laravel)
    location ~ ^/storage/ {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/jalankita /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default   # hapus default
sudo nginx -t && sudo systemctl reload nginx
```

### 4.18 Supervisor — Queue Worker

```ini
# /etc/supervisor/conf.d/jalankita-worker.conf

[program:jalankita-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/jalankita/backend_POSTGRESQL/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ubuntu
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/jalankita/storage/logs/supervisor-worker.log
stopwaitsecs=3600
```

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all

# Verifikasi
sudo supervisorctl status
# Output: jalankita-worker:jalankita-worker_00   RUNNING   pid 1234, uptime 0:00:10
```

### 4.19 Cron — Scheduler

```bash
crontab -e
# Pilih nano, tambahkan baris berikut:

* * * * * cd /var/www/jalankita/backend_POSTGRESQL && php artisan schedule:run >> /dev/null 2>&1
```

### 4.20 Optimasi RAM

Karena hanya 1GB RAM, setiap MB berharga.

**PHP-FPM — `/etc/php/8.3/fpm/pool.d/www.conf`:**

```ini
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
pm.max_requests = 500
```

**PostgreSQL — `/etc/postgresql/16/main/postgresql.conf`:**

```ini
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 32MB
max_connections = 20
random_page_cost = 1.1
```

**Nginx — `/etc/nginx/nginx.conf`:**

```nginx
worker_processes 1;  # 1 vCPU cukup 1 worker
events {
    worker_connections 256;
}
http {
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
}
```

**Hapus service yang tidak perlu:**

```bash
sudo systemctl disable --now cups.service
sudo systemctl disable --now snapd.service
sudo systemctl disable --now systemd-resolved.service  # Hati-hati, perlu DNS alternatif
```

**Cek pemakaian RAM:**

```bash
free -h
htop
```

Target: idle ~400-500MB, tersisa ~500MB untuk PHP-FPM + PostgreSQL.

### 4.21 Firewall (Lightsail)

Lightsail sudah punya firewall bawaan. Pastikan port terbuka:

| Port | Source | Untuk |
|---|---|---|
| 22 | Your IP (atau 0.0.0.0/0) | SSH |
| 80 | 0.0.0.0/0 | HTTP |
| 443 | 0.0.0.0/0 | HTTPS |

Di Lightsail Console → instance → Networking → Firewall:
- Tambahkan rule HTTP (80) dan HTTPS (443) jika belum ada

Jangan buka port 5432 (PostgreSQL) — cukup koneksi lokal via unix socket.

---

## 5. Phase 3: Frontend Vercel

> **Tujuan:** TanStack Start SSR berjalan di Vercel Hobby ($0/bln) dengan Nitro.

### 5.1 Install Nitro

```bash
cd Frontend-stable
npm install nitro
```

### 5.2 Update vite.config.ts

File: `Frontend-stable/vite.config.ts`

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { nitro } from "nitro/vite";                          // <-- TAMBAHKAN

function injectLeafletGlobalPlugin(): Plugin { ... }          // (existing)
```

Tambahkan `nitro()` ke array plugins:

```ts
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    injectLeafletGlobalPlugin(),
    VitePWA({ ... }),       // (existing)
    nitro(),                // <-- TAMBAHKAN — adapter Vercel
  ],
  vite: {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
        "/storage": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
});
```

> ⚠️ **Catatan:** Jika terjadi konflik plugin (karena `@lovable.dev/vite-tanstack-config` sudah bundle tanstackStart), hapus sementara wrapper dan gunakan config manual biasa:
> ```ts
> import { defineConfig } from "vite";
> import { tanstackStart } from "@tanstack/react-start/plugin/vite";
> import viteReact from "@vitejs/plugin-react";
> import { nitro } from "nitro/vite";
> ```

### 5.3 Test Build Lokal

```bash
cd Frontend-stable
npm run build
```

Verifikasi ada folder `.vercel/output/` — ini output Nitro untuk Vercel.

### 5.4 Production Environment Variables

Di **Vercel Dashboard** → Project `jalankita-frontend` → Settings → Environment Variables:

| Key | Value | Environment |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.jalankita.sidoarjo.go.id/api` | Production |
| `NITRO_PRESET` | `vercel` | Production |
| `NODE_VERSION` | `22` | All |

### 5.5 Hubungkan ke Vercel

1. Buka https://vercel.com
2. **Add New** → **Project**
3. Import repo GitHub `DeltaJalan`
4. Framework preset: Vercel akan auto-detect **TanStack Start**
5. Root directory: **`Frontend-stable/`**
6. Build command: (biarkan default — Vercel auto-set)
7. Output directory: `.vercel/output` (Nitro)
8. Klik **Deploy**

Setelah deploy selesai, Vercel akan memberikan URL: `https://jalankita-frontend.vercel.app`

### 5.6 Custom Domain

Di Vercel → Project → Settings → Domains:
- Tambahkan `app.jalankita.sidoarjo.go.id`
- Vercel akan memberikan CNAME target

### 5.7 Auto-deploy

Vercel sudah otomatis: setiap `git push ke main` → trigger build + deploy ulang.
Tidak perlu workflow Actions untuk frontend.

---

## 6. Phase 4: GitHub Actions CI/CD

> **Tujuan:** Setiap push ke `main` → otomatis deploy backend ke Lightsail + AI Lambda.

### 6.1 Setup SSH Key (Lightsail)

Di server Lightsail:

```bash
# Generate key khusus untuk GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/github-actions -N ""

# Tambahkan ke authorized_keys
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys

# Test: private key tetap di local (jangan commit!)
cat ~/.ssh/github-actions
# -----BEGIN OPENSSH PRIVATE KEY-----
# ... (copy ini ke GitHub Secret)
# -----END OPENSSH PRIVATE KEY-----
```

### 6.2 GitHub Secrets

Buka repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value | Untuk |
|---|---|---|
| `LIGHTSAIL_HOST` | `13.250.xxx.xxx` | IP static Lightsail |
| `LIGHTSAIL_USER` | `ubuntu` | User SSH |
| `LIGHTSAIL_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` | Private key SSH |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Deploy Lambda |
| `AWS_SECRET_ACCESS_KEY` | `...` | Deploy Lambda |
| `AWS_REGION` | `ap-southeast-1` | Region AWS |
| `ECR_REPOSITORY_URI` | `<account>.dkr.ecr.ap-southeast-1.amazonaws.com/jalankita-ai` | ECR |
| `LAMBDA_FUNCTION_NAME` | `jalankita-ai` | Lambda |

### 6.3 Workflow: Deploy Backend

**File:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend to Lightsail

on:
  push:
    branches: [main]
    paths:
      - 'backend_POSTGRESQL/**'
      - '.github/workflows/deploy-backend.yml'

concurrency:
  group: deploy-backend
  cancel-in-progress: true

jobs:
  deploy:
    name: Deploy Laravel via SSH
    runs-on: ubuntu-24.04
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Lightsail via SSH
        uses: appleboy/ssh-action@v1.2.1
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            set -e

            echo "[1/7] Pull latest code..."
            cd /var/www/jalankita
            git pull origin main

            echo "[2/7] Composer install (production)..."
            cd backend_POSTGRESQL
            export COMPOSER_ALLOW_SUPERUSER=1
            composer install --no-dev --optimize-autoloader --no-interaction

            echo "[3/7] Run migrations..."
            php artisan migrate --force

            echo "[4/7] Clear & rebuild cache..."
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache

            echo "[5/7] Restart queue worker..."
            sudo supervisorctl restart jalankita-worker:*

            echo "[6/7] Reload PHP-FPM..."
            sudo systemctl reload php8.3-fpm

            echo "[7/7] Deploy selesai!"
            echo "Timestamp: $(date)"
```

### 6.4 Workflow: Deploy AI Lambda

**File:** `.github/workflows/deploy-ai.yml`

```yaml
name: Deploy AI Lambda

on:
  push:
    branches: [main]
    paths:
      - 'backend_AI/lambda/**'
      - '.github/workflows/deploy-ai.yml'

concurrency:
  group: deploy-ai
  cancel-in-progress: true

jobs:
  deploy:
    name: Build & Deploy Lambda Container
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: jalankita-ai
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend_AI/lambda
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Update Lambda function code
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: jalankita-ai
          IMAGE_TAG: ${{ github.sha }}
        run: |
          aws lambda update-function-code \
            --function-name ${{ secrets.LAMBDA_FUNCTION_NAME }} \
            --image-uri $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            --publish

      - name: Verify Lambda deployment
        run: |
          aws lambda get-function --function-name ${{ secrets.LAMBDA_FUNCTION_NAME }} \
            --query 'Configuration.LastModified'
```

### 6.5 Workflow: Health Check (Monitoring)

**File:** `.github/workflows/health-check.yml`

```yaml
name: Health Check

on:
  schedule:
    - cron: '*/30 * * * *'  # Setiap 30 menit
  workflow_dispatch:          # Bisa di-run manual

jobs:
  check:
    name: Endpoint Health Check
    runs-on: ubuntu-24.04
    timeout-minutes: 2

    steps:
      - name: Check Frontend
        run: |
          curl -sSf -o /dev/null -w "Frontend: HTTP %{http_code}\n" \
            https://app.jalankita.sidoarjo.go.id/ || \
            echo "⚠️ Frontend DOWN"

      - name: Check API Health
        run: |
          curl -sSf -o /dev/null -w "API Health: HTTP %{http_code}\n" \
            https://api.jalankita.sidoarjo.go.id/api/health || \
            echo "⚠️ API DOWN"

      - name: Check Lambda AI
        run: |
          curl -sSf -o /dev/null -w "Lambda AI: HTTP %{http_code}\n" \
            https://xxxxx.lambda-url.ap-southeast-1.on.aws/ || \
            echo "⚠️ Lambda AI DOWN"
```

---

## 7. Phase 5: Domain & DNS

### 7.1 Cloudflare Setup

1. Daftar/Login ke **Cloudflare**
2. **Add a domain** — masukkan `jalankita.sidoarjo.go.id`
3. Cloudflare akan scan DNS records yang ada
4. Ganti nameserver domain ke Cloudflare (dari registar domain)

### 7.2 DNS Records

| Type | Name | Value | Proxy Status |
|---|---|---|---|
| **A** | `api` | `13.250.xxx.xxx` (Lightsail IP) | ✅ Proxied (orange cloud) |
| **CNAME** | `app` | `jalankita-frontend.vercel.app` | ✅ Proxied |
| **CNAME** | `www` | `jalankita-frontend.vercel.app` | ✅ Proxied |

### 7.3 SSL/TLS

**Cloudflare SSL/TLS setting:**
- Mode: **Full** (strict) — rekomendasi
- Atau **Flexible** jika Lightsail belum ada SSL

**Lightsail — SSL via Certbot:**

```bash
# Pastikan DNS api.xxx.com sudah mengarah ke IP Lightsail
sudo certbot --nginx -d api.jalankita.sidoarjo.go.id

# Ikuti wizard — pilih opsi redirect HTTP → HTTPS

# Verifikasi auto-renewal
sudo certbot renew --dry-run
```

---

## 8. Phase 6: Monitoring & Maintenance

### 8.1 Health Check Otomatis

GitHub Actions sudah menjalankan health check setiap 30 menit (lihat 6.5).

Jika ada endpoint down:
- GitHub akan kirim email notifikasi (bawaan)
- Bisa ditambah notifikasi Telegram dengan tambahan step di workflow

### 8.2 Daily Check (Manual)

SSH ke Lightsail dan cek:

```bash
# System resources
htop                                          # RAM/CPU realtime
df -h                                         # Disk usage (40GB NVMe)
sudo du -sh /var/www/jalankita/storage/app/public/  # Size foto

# Services
sudo systemctl status nginx
sudo systemctl status php8.3-fpm
sudo systemctl status postgresql
sudo supervisorctl status                     # Queue worker
sudo systemctl list-timers --all              # Cron
```

### 8.3 Logging

```bash
# Laravel log
tail -n 100 -f /var/www/jalankita/storage/logs/laravel.log

# Nginx access/error
tail -n 100 -f /var/log/nginx/jalankita-access.log
tail -n 100 -f /var/log/nginx/jalankita-error.log

# Supervisor worker
tail -n 100 -f /var/www/jalankita/storage/logs/supervisor-worker.log
```

### 8.4 Backup Strategy

**Database — otomatis setiap hari jam 03:00:**

```bash
# /home/ubuntu/backup.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR

# Dump database
pg_dump -U jalankita jalankita | gzip > $BACKUP_DIR/jalankita_$TIMESTAMP.sql.gz

# Hapus backup lebih dari 30 hari
find $BACKUP_DIR -name "jalankita_*.sql.gz" -mtime +30 -delete

# Opsional: upload ke S3
# aws s3 cp $BACKUP_DIR/jalankita_$TIMESTAMP.sql.gz s3://jalankita-backups/
```

```bash
chmod +x /home/ubuntu/backup.sh

# Cron: setiap hari jam 3 pagi
crontab -l | { cat; echo "0 3 * * * /home/ubuntu/backup.sh"; } | crontab -
```

### 8.5 Monitor RAM

```bash
# Alert jika RAM usage > 90%
*/5 * * * * free -m | awk '/Mem:/ {if ($3/$2 > 0.9) print "RAM critical: "$3"MB/"$2"MB"}' >> /var/log/ram-monitor.log
```

### 8.6 Log Rotation

```bash
# /etc/logrotate.d/jalankita
/var/www/jalankita/storage/logs/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
}
```

---

## 9. Biaya Total

### 9.1 Per Bulan (dengan $100 credit aktif)

| Komponen | Biaya/bln | Dari $100 Credit? | Catatan |
|---|---|---|---|
| **Vercel Hobby** | **$0** | ❌ | Frontend SSR, free tier permanent |
| **AWS Lightsail $5** | **$5** | ✅ Ya | Backend + DB, Singapore |
| **AWS Lambda** | **$0** | ❌ | Always Free: 1M req/bln |
| **AWS S3** | **$0** | ❌ | Always Free: 5GB (cukup untuk backup) |
| **AWS CloudFront** | **$0** | ❌ | Always Free: 1TB egress |
| **GitHub Actions** | **$0** | ❌ | Public repo = free minutes |
| **Cloudflare** | **$0** | ❌ | DNS + CDN + SSL |
| **Domain** | **~$0.83** ($10/thn) | ❌ | Bayar tahunan ke registrar |
| **Subtotal** | **$5.83** | ✅ **$5 dari credit** | |

### 9.2 Proyeksi 24 Bulan

| Bulan Ke | Biaya/bln | Credit Tersisa | Bayar Tunai |
|---|---|---|---|
| 1 | $5.83 | $100 | $0.83 (domain) |
| 5 | $5.83 | $71 | $0.83 |
| 10 | $5.83 | $41 | $0.83 |
| **17** | **$5.83** | **$0 (habis)** | **$0.83** |
| 18 | $5.83 | ❌ | **$5.83** |
| 24 | $5.83 | ❌ | $5.83 |

**$100 credit cukup untuk ~17 bulan.** Setelah itu:
- Lightsail $5/bln + domain ≈ $5.83/bln ≈ Rp95rb/bln
- Atau pindah ke Hetzner CX23 (€3.99/bln ≈ Rp70rb)

### 9.3 Perbandingan Opsional

| Opsi | Biaya/bln | Setelah 2 tahun |
|---|---|---|
| 🔴 **AWS Hybrid (plan ini)** | **$5.83** (~Rp95rb) | **$140** ($100 credit + $40 bayar) |
| 🟢 Semua di Hetzner CX23 | €3.99 (~Rp70rb) | €96 (~Rp1,7jt) |
| 🟣 Oracle Always Free | **$0** | **$0** |

---

## 10. Risk Register

| ID | Risiko | Prob. | Dampak | Mitigasi |
|---|---|---|---|---|
| R1 | Lightsail 1GB RAM OOM | Medium | Tinggi — service restart | Monitor RAM via cron; turunkan `pm.max_children=3`; upgrade $10/mo jika perlu |
| R2 | Lambda cold start 5-6 detik | High | Rendah — user tunggu | Acceptable untuk upload flow; tidak perlu Provisioned Concurrency |
| R3 | Vercel CPU quota (4 jam/bln) habis | Low | Medium — frontend down 30 hari | Optimasi SSR: cache page statis, kurangi API calls dari server |
| R4 | Vercel Hobby = non-commercial | Medium | Medium — TOS violation | Jika Dinas PU dianggap komersial → upgrade Pro $20/bln |
| R5 | PostgreSQL 0.5GB > RAM | Medium | Medium — slow queries | Indexing; archive data lama ke S3 |
| R6 | Disk 40GB penuh foto | Medium | Medium — upload gagal | Archive foto lama >6 bulan ke S3; backup + hapus lokal |
| R7 | AWS credit habis sebelum bulan 17 | Low | Rendah — tagihan mulai | Set billing alert AWS di $80; pantau monthly credit |
| R8 | GitHub Actions SSH timeout >15m | Low | Rendah — deploy gagal | Retry; split composer install ke step terpisah |
| R9 | Domain .go.id sulit didapat | Medium | Tinggi — pakai domain lain | Siapkan .com atau .sch.id sebagai cadangan |
| R10 | ngrok URL berubah (dev) | Low | Rendah | Hanya untuk development; production pakai Lightsail |

---

## 11. Urutan Eksekusi

### Estimasi Total: 12-14 jam kerja

| # | Phase | Task | Durasi | Dependensi |
|---|---|---|---|---|
| 1 | **Akun** | Daftar AWS → selesaikan 5 onboarding tasks → dapat $200 credit | 30 menit | - |
| 2 | **Akun** | Daftar Vercel + Cloudflare + siapkan domain | 20 menit | - |
| 3 | **Phase 1** | Export model ke ONNX | 30 menit | Repo lokal |
| 4 | **Phase 1** | Buat handler.py + Dockerfile | 2-3 jam | Step 3 |
| 5 | **Phase 1** | Deploy Lambda + test | 1 jam | Step 4, AWS akun |
| 6 | **Phase 2** | Launch Lightsail + provisioning | 2-3 jam | AWS akun |
| 7 | **Phase 2** | Setup Laravel + Nginx + DB | 2 jam | Step 6 |
| 8 | **Phase 2** | Setup Supervisor + Cron + Optimasi RAM | 1 jam | Step 7 |
| 9 | **Phase 3** | Install Nitro, update vite.config, test build | 1 jam | Repo lokal |
| 10 | **Phase 3** | Deploy ke Vercel + set env vars | 30 menit | Step 9 |
| 11 | **Phase 4** | Setup SSH key + GitHub Secrets | 15 menit | Step 6 |
| 12 | **Phase 4** | Buat workflow backend + AI | 1 jam | Step 11 |
| 13 | **Phase 5** | Cloudflare DNS + SSL Certbot | 1 jam | Domain + Step 6 |

### Checklist Go-Live

- [ ] Lambda: `curl` test AI inference sukses
- [ ] Lightsail: `php artisan test` lulus (atau test endpoint /api/health)
- [ ] Vercel: frontend bisa diakses via domain
- [ ] Lightsail: queue worker berjalan (`supervisorctl status`)
- [ ] Lightsail: cron scheduler berjalan (`php artisan schedule:list`)
- [ ] Lightsail: SSL valid (`curl -I https://api.domain.com`)
- [ ] CI/CD: Push ke `main` → backend auto-deploy
- [ ] CI/CD: Health check berjalan tiap 30 menit
- [ ] Backup: cron backup berjalan (`ls -la /home/ubuntu/backups/`)
- [ ] Monitoring: billing alert AWS aktif

---

> **Dokumen ini dibuat Juni 2026.** Harga dan kebijakan AWS/GitHub/Vercel dapat berubah. Selalu cek halaman pricing resmi sebelum eksekusi.
