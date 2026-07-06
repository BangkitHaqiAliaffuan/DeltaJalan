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
import argparse
from pathlib import Path
import concurrent.futures

# Parse command-line arguments
parser = argparse.ArgumentParser(description="JalanKita AI API Server")
parser.add_argument(
    "--mode",
    type=str,
    choices=["ensemble", "single"],
    default="ensemble",
    help="Mode inferensi: 'ensemble' (default, WBF 2 models) atau 'single' (best.pt saja)"
)
parser.add_argument(
    "--model",
    type=str,
    default="best",
    help="Nama model untuk mode single (default: 'best')"
)
args, unknown = parser.parse_known_args()

MODE = args.mode
SINGLE_MODEL_NAME = args.model

app = FastAPI(title="JalanKita API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRIPT_DIR = Path(__file__).parent


def _pick_model_path(name):
    onnx_path = SCRIPT_DIR / f"{name}.onnx"
    pt_path = SCRIPT_DIR / f"{name}.pt"
    if onnx_path.exists():
        if pt_path.exists():
            print(f"  {name}: using .onnx (prefer ONNX)")
        return onnx_path
    if pt_path.exists():
        print(f"  {name}: using .pt (ONNX not found)")
        return pt_path
    raise FileNotFoundError(
        f"Model {name}.pt/.onnx tidak ditemukan di {SCRIPT_DIR}"
    )


# --- best_stable → best class remap ---
# best_stable has: 0=lubang_besar,1=lubang_kecil,2=retak_kulit_buaya,3=retak_memanjang
# best has:        0=lubang,       1=retak_buaya,  2=retak_memanjang,   3=retak_melintang
OLD_TO_BEST = {0: 0, 1: 0, 2: 1, 3: 2}

def _remap_boxes(boxes, mapping):
    return [[x1, y1, x2, y2, conf, mapping.get(cls, cls)] for x1, y1, x2, y2, conf, cls in boxes]

# --- Load models based on mode ---
if MODE == "ensemble":
    # --- Ensemble config ---
    CONF_THRESHOLD = 0.2
    WBF_IOU_THR = 0.5
    CONF_TYPE = "max"  # "max" or "avg"

    # --- Load 2 models ---
    MODEL_A_NAME = "best"
    MODEL_B_NAME = "best_stable"
    MODEL_A_PATH = _pick_model_path(MODEL_A_NAME)
    MODEL_B_PATH = _pick_model_path(MODEL_B_NAME)

    print(f"Loading model A ({MODEL_A_NAME}): {MODEL_A_PATH}")
    model_a = YOLO(str(MODEL_A_PATH))
    print(f"Loading model B ({MODEL_B_NAME}): {MODEL_B_PATH}")
    model_b = YOLO(str(MODEL_B_PATH))
    print("Ensemble models berhasil dimuat!")
    
    model = None  # Not used in ensemble mode
else:
    # --- Single model mode ---
    CONF_THRESHOLD = 0.4
    WBF_IOU_THR = 0.5
    
    MODEL_PATH = _pick_model_path(SINGLE_MODEL_NAME)
    print(f"Loading single model ({SINGLE_MODEL_NAME}): {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))
    print("Model berhasil dimuat!")
    
    model_a = None
    model_b = None
    CONF_TYPE = None

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

# Threshold: bbox area < 1% of image area → "lubang kecil" → severity turun
SMALL_BBOX_AREA_RATIO = 0.01

BOX_COLORS = {
    0: (0,   80,  200),
    1: (0,  120,  200),
    2: (160,  0,  160),
    3: (200, 160,   0),
}

SEVERITY_RANK = {"Baik": 0, "Rusak Ringan": 1, "Rusak Sedang": 2, "Rusak Berat": 3}

SEVERITY_THRESHOLD_BERAT = 2.5
SEVERITY_THRESHOLD_SEDANG = 1.5

# SHA-256 result cache — TTL 1 jam
INFERENCE_CACHE = {}
CACHE_TTL = 3600

# ---------------------------------------------------------------------------
#  WBF helpers
# ---------------------------------------------------------------------------

def _compute_sha256(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def _extract_boxes(results):
    if results.boxes is None or len(results.boxes) == 0:
        return []
    xyxy = results.boxes.xyxy.cpu().numpy()
    confs = results.boxes.conf.cpu().numpy()
    clss = results.boxes.cls.cpu().numpy()
    return [
        [int(xyxy[i][0]), int(xyxy[i][1]), int(xyxy[i][2]), int(xyxy[i][3]),
         float(confs[i]), int(clss[i])]
        for i in range(len(xyxy))
    ]


def _weighted_boxes_fusion(boxes_per_model, conf_type="max", iou_thr=0.5):
    all_boxes = []
    weight = 1.0 / len(boxes_per_model)
    for model_boxes in boxes_per_model:
        for x1, y1, x2, y2, conf, cls in model_boxes:
            all_boxes.append([x1, y1, x2, y2, conf, cls, weight])

    if not all_boxes:
        return []

    all_boxes.sort(key=lambda x: x[4], reverse=True)
    n_models = len(boxes_per_model)

    clusters = []
    for box in all_boxes:
        x1, y1, x2, y2, conf, cls, weight = box
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

        cls_votes = {}
        for b in boxes:
            cls_votes[b[5]] = cls_votes.get(b[5], 0) + b[4]
        final_cls = max(cls_votes, key=cls_votes.get)

        result.append([x1, y1, x2, y2, final_conf, final_cls])

    result.sort(key=lambda x: x[4], reverse=True)
    return result


def _suppress_contained_boxes(detections, containment_ratio=0.7):
    """
    Suppress detections whose bounding box is substantially contained
    within a larger detection of the same class.

    This handles the case where one model outputs a large bbox and
    another model outputs a small bbox for the same object. WBF with
    a standard IoU threshold (e.g. 0.5) can miss this because IoU
    between a small contained box and a much larger box can be very low.
    """
    if not detections:
        return []

    sorted_dets = sorted(detections, key=lambda b: (b[3] - b[1]) * (b[2] - b[0]), reverse=True)

    keep = []
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


# ---------------------------------------------------------------------------
#  NEW SEVERITY SCORING
# ---------------------------------------------------------------------------

def compute_severity_new(detections: list, img_w: int, img_h: int):
    """
    Severity scoring yang robust terhadap variasi angle/distance foto.
    
    Primary:   Class composition (invariant)
    Secondary: Detection count (mostly invariant)
    Tertiary:  Class diversity (invariant)
    Quaternary: Confidence (mostly invariant)
    Quinary:   Area ratio (minor, hanya kasus ekstrim)
    """
    if not detections:
        return "Baik", 0.0, {}

    n = len(detections)
    classes = [d["class"] for d in detections]
    confs = [d["confidence"] for d in detections]
    avg_conf = sum(confs) / n

    score = 0.0
    details = {}

    # ── 1. Class-based base score ──────────────────────────────────────────
    has_lubang = "Lubang" in classes
    has_buaya  = "Retak Kulit Buaya" in classes
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
    else:
        details["class_base"] = "unknown(0)"

    # ── 2. Detection count bonus ───────────────────────────────────────────
    count_bonus = 0.0
    if n >= 5:
        count_bonus = 1.0
    elif n >= 3:
        count_bonus = 0.5
    elif n == 1 and score < 1.0:
        count_bonus = -0.2

    if count_bonus != 0:
        score += count_bonus
        details["count_bonus"] = f"{n}det({count_bonus:+.1f})"

    # ── 3. Class diversity bonus ───────────────────────────────────────────
    unique_classes = len(set(classes))
    diversity_bonus = 0.0
    if unique_classes >= 3:
        diversity_bonus = 0.5
    elif unique_classes >= 2:
        diversity_bonus = 0.2

    if diversity_bonus:
        score += diversity_bonus
        details["diversity"] = f"{unique_classes}cls({diversity_bonus:+.1f})"

    # ── 4. Confidence penalty (softened for WBF ensemble) ──────────────────
    if avg_conf < 0.12:
        score = max(0, score - 0.4)
        details["conf_penalty"] = f"avg_conf={avg_conf:.2f}(-0.4)"
    elif avg_conf < 0.20:
        score = max(0, score - 0.2)
        details["conf_penalty"] = f"avg_conf={avg_conf:.2f}(-0.2)"

    # ── 5. Area ratio — minor modifier, hanya kasus ekstrim ────────────────
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

    # ── Map score to severity ──────────────────────────────────────────────
    if score >= SEVERITY_THRESHOLD_BERAT:
        severity = "Rusak Berat"
    elif score >= SEVERITY_THRESHOLD_SEDANG:
        severity = "Rusak Sedang"
    else:
        severity = "Rusak Ringan"

    return severity, round(score, 2), details


# ---------------------------------------------------------------------------
#  Drawing for merged boxes
# ---------------------------------------------------------------------------

def _draw_merged_detections(img_cv: np.ndarray, merged_boxes: list) -> tuple:
    h_img, w_img = img_cv.shape[:2]
    line_w = max(4, int(min(w_img, h_img) * 0.003))
    label_scale = max(0.55, round(min(w_img, h_img) * 0.0004, 2))
    label_th = max(1, int(min(w_img, h_img) * 0.0008))

    detections = []
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
        cv2.putText(img_cv, label, (x1 + 4, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, label_scale, (255, 255, 255), label_th, cv2.LINE_AA)

        detections.append({
            "class":          name,
            "severity":       sev,
            "confidence":     round(conf, 3),
            "confidence_pct": f"{conf:.0%}",
            "bbox":           {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "area_px":        area_px,
        })

    _, buf = cv2.imencode(".jpg", img_cv, [cv2.IMWRITE_JPEG_QUALITY, 75])
    img_b64 = base64.b64encode(buf).decode()

    if detections:
        worst = max(detections, key=lambda d: SEVERITY_RANK.get(d["severity"], 0))
        overall_severity = worst["severity"]
    else:
        overall_severity = "Baik"

    return img_b64, detections, overall_severity


# ---------------------------------------------------------------------------
#  Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    base_response = {
        "status": "ok",
        "version": "1.3.0",
        "mode": MODE,
        "classes": list(CLASS_LABELS.values()),
        "cache_ttl": CACHE_TTL,
    }
    
    if MODE == "ensemble":
        base_response.update({
            "model": "Ensemble WBF (best + best_stable)",
            "models": [
                {
                    "name": MODEL_A_NAME,
                    "path": str(MODEL_A_PATH),
                    "type": MODEL_A_PATH.suffix.replace(".", ""),
                },
                {
                    "name": MODEL_B_NAME,
                    "path": str(MODEL_B_PATH),
                    "type": MODEL_B_PATH.suffix.replace(".", ""),
                },
            ],
            "ensemble": {
                "conf_threshold": CONF_THRESHOLD,
                "wbf_iou_thr": WBF_IOU_THR,
                "conf_type": CONF_TYPE,
            },
        })
    else:
        base_response.update({
            "model": f"Single model ({SINGLE_MODEL_NAME})",
            "model_path": str(MODEL_PATH),
            "model_type": MODEL_PATH.suffix.replace(".", ""),
            "conf_threshold": CONF_THRESHOLD,
        })
    
    return base_response


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    include_image: bool = Query(True, description="Sertakan base64 image result dalam response"),
):
    contents = await file.read()

    img_hash = _compute_sha256(contents)
    cached = INFERENCE_CACHE.get(img_hash)
    if cached and (time.time() - cached["ts"]) < CACHE_TTL:
        resp = {k: cached[k] for k in ("detections", "total", "overall_severity", "severity_score", "severity_detail", "status")}
        if include_image:
            resp["image_result"] = cached["image_result"]
        return JSONResponse(resp)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img = ImageOps.exif_transpose(img)
        MAX_DIM = 640
        w, h = img.size
        if max(w, h) > MAX_DIM:
            scale = MAX_DIM / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    except Exception:
        return JSONResponse({"status": "error", "message": "File bukan gambar yang valid"}, status_code=400)

    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    h_resized, w_resized = img_cv.shape[:2]

    if MODE == "ensemble":
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_a = executor.submit(model_a.predict, source=img, conf=CONF_THRESHOLD, iou=WBF_IOU_THR, verbose=False)
            future_b = executor.submit(model_b.predict, source=img, conf=CONF_THRESHOLD, iou=WBF_IOU_THR, verbose=False)
            
            r_a = future_a.result()[0]
            r_b = future_b.result()[0]

        boxes_a = _extract_boxes(r_a)
        boxes_b = _extract_boxes(r_b)
        boxes_b = _remap_boxes(boxes_b, OLD_TO_BEST)

        merged = _weighted_boxes_fusion([boxes_a, boxes_b], conf_type=CONF_TYPE, iou_thr=WBF_IOU_THR)
        merged = _suppress_contained_boxes(merged)

        img_b64, detections, _ = _draw_merged_detections(img_cv, merged)
    else:
        results = model.predict(source=img, conf=CONF_THRESHOLD, iou=0.5, verbose=False)[0]
        boxes = _extract_boxes(results)
        boxes = _suppress_contained_boxes(boxes)

        img_b64, detections, _ = _draw_merged_detections(img_cv, boxes)

    # New severity scoring — override overall_severity
    overall_severity, severity_score, severity_detail = compute_severity_new(detections, w_resized, h_resized)

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

    resp = {k: cache_entry[k] for k in ("detections", "total", "overall_severity", "severity_score", "severity_detail", "status")}
    if include_image:
        resp["image_result"] = img_b64

    return JSONResponse(resp)


@app.get("/")
def serve_test_html():
    html_path = SCRIPT_DIR / "test_jalankita (1).html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text("utf-8"))
    return HTMLResponse("<h1>JalanKita API</h1><p>test_jalankita.html tidak ditemukan</p>")


if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print(f"  JalanKita API Server v1.3.0")
    print("=" * 50)
    print(f"  Mode: {MODE.upper()}")
    
    if MODE == "ensemble":
        print(f"  Model A: {MODEL_A_NAME} ({MODEL_A_PATH.suffix})")
        print(f"  Model B: {MODEL_B_NAME} ({MODEL_B_PATH.suffix})")
        print(f"  Ensemble: WBF {CONF_TYPE} confidence")
        print(f"  WBF IoU: {WBF_IOU_THR}")
    else:
        print(f"  Model: {SINGLE_MODEL_NAME} ({MODEL_PATH.suffix})")
    
    print(f"  Conf threshold: {CONF_THRESHOLD}")
    print(f"  Docs:   http://localhost:8000/docs")
    print(f"  Health: http://localhost:8000/health")
    print(f"  Cache:  SHA-256, TTL {CACHE_TTL}s")
    print("=" * 50)
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
