"""
Lambda handler untuk AI inference — WBF ensemble 2 model YOLOv8s.
Port dari server.py (FastAPI) ke AWS Lambda Function URL.

Arsitektur:
1. Lambda menerima request POST dengan file gambar (multipart/form-data atau JSON base64)
2. Preprocess gambar ke tensor (640x640, normalize)
3. Inference 2 model ONNX secara parallel (ThreadPoolExecutor)
4. Weighted Boxes Fusion (WBF) untuk menggabungkan deteksi
5. Severity scoring (class-based + count + diversity + confidence)
6. Draw bounding boxes ke gambar
7. Return JSON hasil (deteksi + image base64 + severity)

Dependencies (minimal — tanpa torch/ultralytics):
- onnxruntime
- opencv-python-headless
- numpy
- Pillow
"""

import json
import base64
import hashlib
import re
import time
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
    "Lubang":            "Rusak Berat",
    "Retak Kulit Buaya": "Rusak Sedang",
    "Retak Memanjang":   "Rusak Ringan",
    "Retak Melintang":   "Rusak Ringan",
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


def _parse_multipart_file(body: bytes, content_type: str) -> bytes | None:
    """Manual multipart/form-data parser — extract binary content of 'file' field."""
    match = re.search(r'boundary=([^;\s]+)', content_type)
    if not match:
        return None
    boundary = match.group(1).encode()

    parts = body.split(b'--' + boundary)
    for part in parts:
        if b'name="file"' not in part:
            continue
        header_end = part.find(b'\r\n\r\n')
        if header_end == -1:
            continue
        data = part[header_end + 4:]
        data = data.rstrip(b'\r\n')
        data = data.rstrip(b'--')
        data = data.rstrip(b'\r\n')
        return data if data else None
    return None


def _extract_file_from_event(event: dict) -> bytes | None:
    """Extract binary image content from Lambda event (multipart or JSON base64)."""
    headers = event.get("headers", {}) or {}
    content_type = headers.get("content-type", headers.get("Content-Type", ""))

    if "application/json" in content_type:
        body = json.loads(event.get("body", "{}"))
        if isinstance(body, str):
            body = json.loads(body)
        image_b64 = body.get("image_base64", body.get("file", ""))
        return base64.b64decode(image_b64) if image_b64 else None

    if event.get("isBase64Encoded", False):
        body_bytes = base64.b64decode(event.get("body", ""))
    else:
        body_bytes = (event.get("body") or "").encode()

    return _parse_multipart_file(body_bytes, content_type)


def _success_response(data: dict, status_code: int = 200) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(data),
    }


def _error_response(status_code: int, message: str) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"status": "error", "message": message}),
    }


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
    arr = np.transpose(arr, (2, 0, 1))   # HWC → CHW
    return np.expand_dims(arr, axis=0)   # → NCHW


def _run_onnx(session: ort.InferenceSession, tensor: np.ndarray) -> list[list[float]]:
    """
    Run ONNX inference, parse output tensor.
    Output YOLOv8: shape [1, C, N] → transpose, filter by conf, normalize bbox to 0-1.
    """
    outputs = session.run(None, {INPUT_NAME: tensor})
    raw = outputs[0]  # shape: [1, C, N] where C = 4 bbox + num_classes

    predictions = np.squeeze(raw).T  # → [N, C]

    # bbox coords are in predictions[:, 0:4] (cx, cy, w, h in pixel 0-640)
    # class scores start at predictions[:, 4:]
    num_classes = predictions.shape[1] - 4

    if num_classes < 1:
        return []

    class_scores = predictions[:, 4:]           # [N, num_classes]
    confidences = class_scores.max(axis=1)       # [N]
    class_ids = class_scores.argmax(axis=1)      # [N]

    mask = confidences >= CONF_THRESHOLD
    predictions = predictions[mask]
    confidences = confidences[mask]
    class_ids = class_ids[mask]

    if len(predictions) == 0:
        return []

    MODEL_INPUT_SIZE = 640.0
    boxes = []
    for i, pred in enumerate(predictions):
        xc, yc, w, h = pred[0], pred[1], pred[2], pred[3]
        # Convert pixel coords (0-640) to normalized (0-1) untuk frontend
        x1 = (xc - w / 2) / MODEL_INPUT_SIZE
        y1 = (yc - h / 2) / MODEL_INPUT_SIZE
        x2 = (xc + w / 2) / MODEL_INPUT_SIZE
        y2 = (yc + h / 2) / MODEL_INPUT_SIZE
        conf = float(confidences[i])
        cls = int(class_ids[i])
        boxes.append([x1, y1, x2, y2, conf, cls])

    return boxes


def _remap_boxes(boxes: list[list[float]], mapping: dict[int, int]) -> list[list[float]]:
    return [[x1, y1, x2, y2, conf, mapping.get(int(cls), int(cls))] for x1, y1, x2, y2, conf, cls in boxes]


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
    """Suppress boxes yang substantially contained dalam kotak same-class yang lebih besar."""
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
    """
    Draw bounding boxes + encode ke base64 JPEG.
    Input boxes are normalized (0-1), scale to pixel untuk drawing.
    Bbox di response tetap normalized (0-1) untuk frontend overlay.
    """
    h_img, w_img = img_cv.shape[:2]
    line_w = max(4, int(min(w_img, h_img) * 0.003))
    label_scale = max(0.55, round(min(w_img, h_img) * 0.0004, 2))
    label_th = max(1, int(min(w_img, h_img) * 0.0008))

    detections: list[dict[str, Any]] = []
    for x1n, y1n, x2n, y2n, conf, cls in merged_boxes:
        cls = int(cls)
        name = CLASS_LABELS.get(cls, "Unknown")
        sev = SEVERITY_MAP.get(name, "Rusak Ringan")

        # Scale normalized (0-1) to pixel coordinates for drawing
        x1 = int(x1n * w_img)
        y1 = int(y1n * h_img)
        x2 = int(x2n * w_img)
        y2 = int(y2n * h_img)

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
            "bbox": {"x1": x1n, "y1": y1n, "x2": x2n, "y2": y2n},
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
#  ENDPOINT HANDLERS — analyze-quality, analyze-relevance, health
# ══════════════════════════════════════════════════════════════════════════════


def _handle_analyze_quality(event: dict) -> dict:
    """Blur/brightness/contrast quality check — mirrors server.py /analyze-quality."""
    image_bytes = _extract_file_from_event(event)
    if image_bytes is None:
        return _error_response(400, "Field 'file' tidak ditemukan di multipart body")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return _error_response(400, "File bukan gambar yang valid")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(laplacian.var())
    mean_brightness = float(np.mean(gray))
    brightness_stddev = float(np.std(gray))

    if blur_score < 100:
        status = "blurry"
    elif mean_brightness < 50:
        status = "too_dark"
    elif mean_brightness > 200:
        status = "too_bright"
    elif brightness_stddev < 25:
        status = "low_contrast"
    else:
        status = "good"

    return _success_response({
        "status": status,
        "blurScore": round(blur_score, 2),
        "meanBrightness": round(mean_brightness, 2),
        "brightnessStdDev": round(brightness_stddev, 2),
    })


def _handle_analyze_relevance() -> dict:
    """Always pass relevance check — MobileCLIP too heavy for Lambda."""
    return _success_response({
        "relevant": True,
        "score": 1.0,
        "label": "Terindikasi Kerusakan Jalan",
    })


def _handle_health_check() -> dict:
    """Quick health/status endpoint."""
    return _success_response({
        "status": "ok",
        "version": "1.3.1",
        "mode": "ensemble",
        "classes": list(CLASS_LABELS.values()),
    })


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
        # ── Routing ──────────────────────────────────────────────────────
        raw_path = event.get("rawPath", "/")
        http_method = event.get("requestContext", {}).get("http", {}).get("method", "POST")

        if raw_path == "/analyze-quality" and http_method == "POST":
            return _handle_analyze_quality(event)
        if raw_path == "/analyze-relevance" and http_method == "POST":
            return _handle_analyze_relevance()
        if raw_path == "/" and http_method == "GET":
            return _handle_health_check()
        if raw_path not in ("/", "/analyze") or http_method != "POST":
            return _error_response(404, "Not found")

        # ── Parse input ──────────────────────────────────────────────────
        image_bytes = _extract_file_from_event(event)
        if image_bytes is None:
            return _error_response(400, "Field 'file' tidak ditemukan di multipart body")

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
