"""
test_severity.py — Test & tuning severity scoring untuk JalanKita YOLO model.

Membandingkan OLD severity (SEVERITY_MAP hardcoded) vs NEW severity
(scoring berbasis class + count + diversity + confidence + area ratio).

Usage:
    python test_severity.py                          # test semua foto
    python test_severity.py --single path/foto.jpg    # test 1 foto
    python test_severity.py --tune                    # coba variasi threshold
"""

import sys, os, json, argparse
from pathlib import Path

# ─── Setup argparse BEFORE importing server (server juga pakai argparse) ───
parser = argparse.ArgumentParser(description="JalanKita Severity Test")
parser.add_argument("--single", type=str, help="Path ke 1 foto untuk test")
parser.add_argument("--tune", action="store_true", help="Coba variasi threshold")
parser.add_argument("--save-images", action="store_true", help="Simpan gambar annotated ke output-dir")
parser.add_argument("--output-dir", type=str, default="output_test", help="Direktori untuk annotated images (default: output_test)")
parser.add_argument("--photo-dir", type=str, default=r"D:\JalanKita\Photos EXIF\Output")
args, _ = parser.parse_known_args()

# ─── Import server.py — reuse model + inference pipeline ──────────────────
# Server menggunakan argparse di module level, jadi kita set sys.argv dulu
sys.argv = ["server.py", "--mode", "ensemble"]
sys.path.insert(0, str(Path(__file__).parent))

import server  # noqa: E402
from server import (  # noqa: E402
    MODE, model_a, model_b, model,
    _extract_boxes, _remap_boxes, OLD_TO_BEST,
    _weighted_boxes_fusion, CONF_THRESHOLD, WBF_IOU_THR, CONF_TYPE,
    CLASS_LABELS, SEVERITY_MAP, SEVERITY_RANK, SMALL_BBOX_AREA_RATIO,
)
from PIL import Image, ImageOps  # noqa: E402
import cv2  # noqa: E402
import numpy as np  # noqa: E402


# ─── Annotation colors ────────────────────────────────────────────────────
CLASS_COLORS = {
    "Lubang":             (0,   0,   255),  # merah
    "Retak Memanjang":    (255, 165, 0),    # oranye
    "Retak Melintang":    (0,   255, 255),  # kuning
    "Retak Pinggir":      (255, 255, 0),    # cyan
    "Retak Sambungan":    (128, 0,   128),  # ungu
}
SEVERITY_COLORS = {
    "Baik":             (0,   255, 0),    # hijau
    "Rusak Ringan":     (0,   255, 255),  # kuning
    "Rusak Sedang":     (0,   165, 255),  # oranye
    "Rusak Berat":      (0,   0,   255),  # merah
}


def draw_annotated_image(
    img_path: str,
    detections: list,
    old_sev: str,
    new_sev: str,
    score: float,
    new_detail: dict,
    output_dir: str,
    inf_w: int,
    inf_h: int,
):
    """Buat annotated image dengan bounding box + severity info.

    Koordinat bbox dari inference (inf_w x inf_h) di-scale ke ukuran gambar asli
    supaya posisi bounding box sesuai dengan objek di gambar."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(img_path).convert("RGB")
    img = ImageOps.exif_transpose(img)
    draw = ImageDraw.Draw(img)

    w, h = img.size
    scale_x = w / inf_w
    scale_y = h / inf_h

    # Cari font sistem yang reliable
    font_paths = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/consola.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    font_path = None
    for fp in font_paths:
        if os.path.exists(fp):
            font_path = fp
            break

    base_pt = max(14, int(min(w, h) / 70))

    # ── Draw bounding boxes (scaled) ──────────────────────────────────────
    thickness = max(3, int(min(w, h) / 400))

    for d in detections:
        cls = d["class"]
        b = d["bbox"]
        color = CLASS_COLORS.get(cls, (255, 255, 255))
        conf = d["confidence"]

        x1 = int(b["x1"] * scale_x)
        y1 = int(b["y1"] * scale_y)
        x2 = int(b["x2"] * scale_x)
        y2 = int(b["y2"] * scale_y)

        draw.rectangle([(x1, y1), (x2, y2)], outline=color, width=thickness)

        label = f"{cls} {conf:.2f}"
        label_pt = max(12, int(base_pt * 0.85))
        try:
            flbl = ImageFont.truetype(font_path, label_pt)
        except Exception:
            flbl = ImageFont.load_default()
        lbbox = draw.textbbox((x1, y1 - label_pt - 4), label, font=flbl)
        draw.rectangle(lbbox, fill=(0, 0, 0))
        draw.text((x1, y1 - label_pt - 4), label, font=flbl, fill=color)

    # ── Severity overlay (top-left) ──────────────────────────────────────
    sev_color = SEVERITY_COLORS.get(new_sev, (255, 255, 255))
    title = f"OLD: {old_sev}  →  NEW: {new_sev}  (score={score:.1f})"

    title_pt = max(18, int(base_pt * 1.2))
    try:
        ftitle = ImageFont.truetype(font_path, title_pt)
    except Exception:
        ftitle = ImageFont.load_default()

    margin = 8
    cx, cy = margin, margin
    tbbox = draw.textbbox((cx, cy), title, font=ftitle)
    pad = 6
    draw.rectangle(
        [(tbbox[0] - pad, tbbox[1] - pad), (tbbox[2] + pad, tbbox[3] + pad)],
        fill=(0, 0, 0),
        outline=sev_color,
        width=2,
    )
    draw.text((cx, cy), title, font=ftitle, fill=sev_color)

    # Breakdown text
    if new_detail:
        detail_str = "  |  ".join(f"{k}={v}" for k, v in new_detail.items())
        detail_pt = max(13, int(base_pt * 0.75))
        try:
            fdet = ImageFont.truetype(font_path, detail_pt)
        except Exception:
            fdet = ImageFont.load_default()
        dy = cy + tbbox[3] - tbbox[1] + margin
        dbbox = draw.textbbox((cx, dy), detail_str, font=fdet)
        draw.rectangle(
            [(dbbox[0] - pad, dbbox[1] - pad), (dbbox[2] + pad, dbbox[3] + pad)],
            fill=(0, 0, 0),
        )
        draw.text((cx, dy), detail_str, font=fdet, fill=(220, 220, 220))

    # ── Save ──────────────────────────────────────────────────────────────
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem = Path(img_path).stem
    safe_sev = new_sev.replace(" ", "_")
    safe_old = old_sev.replace(" ", "_")
    filename = f"{safe_old}__{safe_sev}__{score:.1f}__{stem}.jpg"
    img.save(str(out / filename), quality=92)
    print(f"       Saved: {out.name}/{filename}")


# ═══════════════════════════════════════════════════════════════════════════
#  NEW SEVERITY SCORING (proposed)
# ═══════════════════════════════════════════════════════════════════════════

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
    # WBF ensemble confidence typically 0.15-0.35, so penalty only for very low
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
    if score >= 2.5:
        severity = "Rusak Berat"
    elif score >= 1.5:
        severity = "Rusak Sedang"
    else:
        severity = "Rusak Ringan"

    return severity, round(score, 2), details


# ═══════════════════════════════════════════════════════════════════════════
#  OLD SEVERITY (current SEVERITY_MAP — sebagai baseline)
# ═══════════════════════════════════════════════════════════════════════════

def old_severity_from_detections(detections: list, img_w: int, img_h: int):
    """Reimplementasi logika severity LAMA dari server.py _draw_merged_detections."""
    if not detections:
        return "Baik", None

    # Rebuild severity per detection pakai logika server.py
    scored = []
    for d in detections:
        name = d["class"]
        sev = SEVERITY_MAP.get(name, "Rusak Ringan")
        b = d["bbox"]
        area_px = (b["x2"] - b["x1"]) * (b["y2"] - b["y1"])

        # Small bbox downgrade (hanya untuk class 0 / Lubang)
        cls_idx = [k for k, v in CLASS_LABELS.items() if v == name]
        if cls_idx and cls_idx[0] == 0 and area_px < SMALL_BBOX_AREA_RATIO * img_w * img_h:
            sev = "Rusak Ringan"

        scored.append({"class": name, "severity": sev, "confidence": d["confidence"]})

    # Overall = worst
    worst = max(scored, key=lambda x: SEVERITY_RANK.get(x["severity"], 0))
    overall = worst["severity"]

    # Detail string
    detail_parts = [f"{s['class']}={s['severity']}" for s in scored]
    return overall, ", ".join(detail_parts)


# ═══════════════════════════════════════════════════════════════════════════
#  INFERENCE WRAPPER
# ═══════════════════════════════════════════════════════════════════════════

def run_inference(photo_path: str):
    """Run YOLO ensemble inference, kembalikan raw detections + image dims."""
    img = Image.open(photo_path).convert("RGB")
    img = ImageOps.exif_transpose(img)
    MAX_DIM = 1280
    w, h = img.size
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    w, h = img.size

    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    if MODE == "ensemble":
        r_a = model_a.predict(source=img, conf=CONF_THRESHOLD, iou=WBF_IOU_THR, verbose=False)[0]
        r_b = model_b.predict(source=img, conf=CONF_THRESHOLD, iou=WBF_IOU_THR, verbose=False)[0]
        boxes_a = _extract_boxes(r_a)
        boxes_b = _extract_boxes(r_b)
        boxes_b = _remap_boxes(boxes_b, OLD_TO_BEST)
        merged = _weighted_boxes_fusion([boxes_a, boxes_b], conf_type=CONF_TYPE, iou_thr=WBF_IOU_THR)
    else:
        results = model.predict(source=img, conf=CONF_THRESHOLD, iou=0.5, verbose=False)[0]
        merged = _extract_boxes(results)

    # Build detections list (sama format seperti server.py)
    detections = []
    for x1, y1, x2, y2, conf, cls in merged:
        cls = int(cls)
        name = CLASS_LABELS.get(cls, "Unknown")
        detections.append({
            "class": name,
            "confidence": round(conf, 3),
            "bbox": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
        })

    return detections, w, h


# ═══════════════════════════════════════════════════════════════════════════
#  TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════

def test_all(photo_dir: str, save_images: bool = False, output_dir: str = "output_test"):
    path = Path(photo_dir)
    photos = sorted(path.glob("*.jpg")) + sorted(path.glob("*.jpeg")) + sorted(path.glob("*.png"))
    print(f"\n{'='*90}")
    print(f"  SEVERITY TEST — {len(photos)} foto" + (" (dengan annotated images)" if save_images else ""))
    print(f"{'='*90}")

    if not photos:
        print(f"  Tidak ada foto di {photo_dir}")
        return

    rows = []
    for i, photo_path in enumerate(photos, 1):
        name = photo_path.name
        detections, w, h = run_inference(str(photo_path))

        n = len(detections)
        classes_summary = ", ".join(sorted(set(d["class"] for d in detections))) if detections else "-"

        old_sev, old_detail = old_severity_from_detections(detections, w, h)
        new_sev, new_score, new_detail = compute_severity_new(detections, w, h)

        # Save annotated image if requested
        if save_images:
            draw_annotated_image(
                str(photo_path), detections,
                old_sev, new_sev, new_score, new_detail,
                output_dir, inf_w=w, inf_h=h,
            )

        # New detail string
        new_detail_str = "; ".join(f"{k}={v}" for k, v in new_detail.items()) if new_detail else "-"

        rows.append([name, n, classes_summary, old_sev, new_score, new_sev, new_detail_str])

        # Print per-photo summary
        status = "✓" if old_sev != new_sev else "="
        print(f"\n  [{i}/{len(photos)}] {status} {name}")
        print(f"       Detections: {n} ({classes_summary})")
        print(f"       Image:      {w}x{h}")
        print(f"       OLD:        {old_sev}" + (f" [{old_detail}]" if old_detail else ""))
        print(f"       NEW:        {new_sev} (score={new_score})")
        if new_detail:
            print(f"       Breakdown:  {new_detail_str}")

    # ── Summary table ──────────────────────────────────────────────────────
    print(f"\n{'='*90}")
    print(f"  SUMMARY TABLE")
    print(f"{'='*90}")
    header = f"{'Photo':<28} {'#':>3}  {'Classes':<30} {'OLD':<15} {'Score':>6}  {'NEW':<15}"
    sep = "-" * 90
    print(header)
    print(sep)
    for row in rows:
        print(f"{row[0]:<28} {row[1]:>3}  {row[2]:<30} {row[3]:<15} {row[4]:>6}  {row[5]:<15}")

    # ── Distribusi ─────────────────────────────────────────────────────────
    print(f"\n{'='*90}")
    print(f"  DISTRIBUTION")
    print(f"{'='*90}")
    old_dist = {}
    new_dist = {}
    for r in rows:
        old_dist[r[3]] = old_dist.get(r[3], 0) + 1
        new_dist[r[5]] = new_dist.get(r[5], 0) + 1

    print(f"  {'Severity':<20} {'OLD Count':<12} {'NEW Count':<12}")
    print(f"  {'─'*44}")
    for sev in ["Baik", "Rusak Ringan", "Rusak Sedang", "Rusak Berat"]:
        oc = old_dist.get(sev, 0)
        nc = new_dist.get(sev, 0)
        print(f"  {sev:<20} {oc:<12} {nc:<12}")
    print()

    # Changes
    changes = sum(1 for r in rows if r[3] != r[5])
    print(f"  Photos changed: {changes}/{len(rows)} ({changes/len(rows)*100:.0f}%)")

    return rows


def test_single(photo_path: str):
    path = Path(photo_path)
    if not path.exists():
        print(f"File tidak ditemukan: {photo_path}")
        return

    print(f"\n{'='*70}")
    print(f"  SINGLE PHOTO TEST: {path.name}")
    print(f"{'='*70}")

    detections, w, h = run_inference(str(path))
    n = len(detections)
    classes_summary = ", ".join(sorted(set(d["class"] for d in detections))) if detections else "-"

    old_sev, old_detail = old_severity_from_detections(detections, w, h)
    new_sev, new_score, new_detail = compute_severity_new(detections, w, h)

    print(f"  Image:       {w}x{h}")
    print(f"  Detections:  {n} ({classes_summary})")
    print(f"  ─────────────────────────────")
    print(f"  OLD severity: {old_sev}")
    if old_detail:
        print(f"  OLD detail:  {old_detail}")
    print(f"  ─────────────────────────────")
    print(f"  NEW severity: {new_sev} (score={new_score})")
    if new_detail:
        for k, v in new_detail.items():
            print(f"    {k}: {v}")
    print()

    # Per-detection detail
    if detections:
        print(f"  Per-detection:")
        for i, d in enumerate(detections, 1):
            b = d["bbox"]
            bw = b["x2"] - b["x1"]
            bh = b["y2"] - b["y1"]
            area_pct = (bw * bh) / (w * h) * 100
            print(f"    {i}. {d['class']} conf={d['confidence']:.2f} "
                  f"bbox={bw}x{bh} area={area_pct:.1f}%")


# ═══════════════════════════════════════════════════════════════════════════
#  THRESHOLD TUNING
# ═══════════════════════════════════════════════════════════════════════════

def tune_thresholds(photo_dir: str):
    """Coba variasi threshold untuk lihat distribusi."""
    path = Path(photo_dir)
    photos = sorted(path.glob("*.jpg")) + sorted(path.glob("*.jpeg")) + sorted(path.glob("*.png"))

    if not photos:
        print(f"Tidak ada foto di {photo_dir}")
        return

    # Kumpulkan scores
    all_scores = []
    for photo_path in photos:
        detections, w, h = run_inference(str(photo_path))
        _, score, _ = compute_severity_new(detections, w, h)
        all_scores.append(score)

    all_scores.sort()

    print(f"\n{'='*80}")
    print(f"  THRESHOLD TUNING — {len(photos)} photos")
    print(f"{'='*80}")

    # Statistical summary
    print(f"\n  Score distribution:")
    print(f"    Min:    {min(all_scores):.2f}")
    print(f"    Max:    {max(all_scores):.2f}")
    print(f"    Median: {all_scores[len(all_scores)//2]:.2f}")
    print(f"    Mean:   {sum(all_scores)/len(all_scores):.2f}")
    print(f"    Scores: {all_scores}")

    # Try different thresholds
    variants = [
        {"name": "Konservatif", "berat": 2.5, "sedang": 1.5},
        {"name": "Ketat (lebih banyak Ringan)", "berat": 3.0, "sedang": 2.0},
        {"name": "Longgar (lebih banyak Berat)", "berat": 2.0, "sedang": 1.0},
    ]

    print(f"\n  {'Variant':<30} {'Ringan':<10} {'Sedang':<10} {'Berat':<10}")
    print(f"  {'─'*60}")
    for v in variants:
        ringan = sum(1 for s in all_scores if s < v["sedang"])
        sedang = sum(1 for s in all_scores if v["sedang"] <= s < v["berat"])
        berat  = sum(1 for s in all_scores if s >= v["berat"])
        print(f"  {v['name']:<30} {ringan:<10} {sedang:<10} {berat:<10}")

    # Recommend thresholds
    print(f"\n  Recommendation:")
    print(f"    Based on score range {min(all_scores):.1f}–{max(all_scores):.1f}:")

    # Find thresholds that give balanced distribution
    for p33, p66 in [(1.0, 2.0), (1.2, 2.2), (1.5, 2.5)]:
        r = sum(1 for s in all_scores if s < p33)
        m = sum(1 for s in all_scores if p33 <= s < p66)
        b = sum(1 for s in all_scores if s >= p66)
        print(f"    Threshold [{p33}, {p66}]: Ringan={r} Sedang={m} Berat={b}")


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if args.single:
        test_single(args.single)
    elif args.tune:
        tune_thresholds(args.photo_dir)
    else:
        test_all(args.photo_dir, save_images=args.save_images, output_dir=args.output_dir)
