"""
check_dataset.py ? JalanKita
Cek kelayakan dataset YOLOv8 secara menyeluruh sebelum training.
Termasuk: kualitas anotasi, distribusi, data leakage, resolusi.

Jalankan: python check_dataset.py
"""

import os
import cv2
import random
import json
import math
import numpy as np
from pathlib import Path
from collections import Counter, defaultdict

DATASET_PATH = r"C:\jalankita dataset\dataset_balanced_clean"
CLASS_NAMES = ["lubang_besar", "lubang_kecil", "retak_kulit_buaya", "retak_memanjang"]
SAMPLE_SIZE = 500
PHASH_SAMPLE = 2000
TINY_THRESH = 0.001
SMALL_THRESH = 0.01
EDGE_MARGIN = 0.05


def dct_based_hash(img: np.ndarray, hash_size: int = 8) -> int:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (hash_size, hash_size))
    dct = cv2.dct(resized.astype(np.float32))
    dct_low = dct[:hash_size, :hash_size]
    med = np.median(dct_low)
    bits = (dct_low > med).flatten()
    h = 0
    for i, b in enumerate(bits):
        if b:
            h |= 1 << (i % 64)
    return h


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def check_split(split: str):
    img_dir = Path(DATASET_PATH) / split / "images"
    lbl_dir = Path(DATASET_PATH) / split / "labels"

    if not img_dir.exists():
        return None

    img_files = sorted(img_dir.glob("*.*"))
    lbl_files = sorted(lbl_dir.glob("*.txt"))

    img_stems = {f.stem for f in img_files}
    lbl_stems = {f.stem for f in lbl_files}
    missing_labels = img_stems - lbl_stems
    missing_images = lbl_stems - img_stems

    class_counter = Counter()
    bbox_areas = []
    bbox_sizes = defaultdict(list)
    aspect_ratios = []
    empty_labels = 0
    corrupt_images = 0
    tiny_images = 0
    oob_bboxes = 0
    edge_bboxes = 0
    total_bboxes = 0
    resolutions = Counter()

    sample_size = min(SAMPLE_SIZE, len(lbl_files))
    sample_files = random.sample(list(lbl_files), sample_size)

    for lbl_file in sample_files:
        lines = [l.strip() for l in lbl_file.read_text().splitlines() if l.strip()]
        if not lines:
            empty_labels += 1
            continue

        img_file = None
        for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
            candidate = img_dir / (lbl_file.stem + ext)
            if candidate.exists():
                img_file = candidate
                break

        img = None
        h_img = w_img = 1
        if img_file:
            img = cv2.imread(str(img_file))
            if img is None:
                corrupt_images += 1
                continue
            h_img, w_img = img.shape[:2]
            if h_img < 64 or w_img < 64:
                tiny_images += 1
            resolutions[f"{w_img}x{h_img}"] += 1
        else:
            continue

        for line in lines:
            parts = line.split()
            if len(parts) < 5:
                continue
            cid = int(parts[0])
            if cid >= len(CLASS_NAMES):
                continue
            cx, cy, w, h = (
                float(parts[1]),
                float(parts[2]),
                float(parts[3]),
                float(parts[4]),
            )

            if cx < 0 or cy < 0 or cx > 1 or cy > 1 or w <= 0 or h <= 0 or w > 1 or h > 1:
                oob_bboxes += 1
                continue

            area = w * h
            total_bboxes += 1
            class_counter[cid] += 1
            bbox_areas.append(area)
            bbox_sizes[cid].append(area)
            aspect_ratios.append(w / h if h > 0 else 0)

            x1 = (cx - w / 2) * w_img
            y1 = (cy - h / 2) * h_img
            x2 = (cx + w / 2) * w_img
            y2 = (cy + h / 2) * h_img
            margin_x = EDGE_MARGIN * w_img
            margin_y = EDGE_MARGIN * h_img
            if (
                x1 < margin_x
                or y1 < margin_y
                or x2 > w_img - margin_x
                or y2 > h_img - margin_y
            ):
                edge_bboxes += 1

    return {
        "split": split,
        "n_images": len(img_files),
        "n_labels": len(lbl_files),
        "missing_labels": len(missing_labels),
        "missing_images": len(missing_images),
        "empty_labels": empty_labels,
        "corrupt_images": corrupt_images,
        "tiny_images": tiny_images,
        "oob_bboxes": oob_bboxes,
        "edge_bboxes": edge_bboxes,
        "total_bboxes": total_bboxes,
        "class_counter": class_counter,
        "bbox_areas": bbox_areas,
        "bbox_sizes": bbox_sizes,
        "aspect_ratios": aspect_ratios,
        "resolutions": resolutions,
        "sample_files": [str(f) for f in sample_files],
    }


def find_near_duplicates(lbl_files, img_dir, max_samples=PHASH_SAMPLE):
    if len(lbl_files) > max_samples:
        lbl_files = random.sample(list(lbl_files), max_samples)

    hashes = []
    for lbl_file in lbl_files:
        for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
            candidate = img_dir / (lbl_file.stem + ext)
            if candidate.exists():
                img = cv2.imread(str(candidate))
                if img is not None:
                    h = dct_based_hash(img)
                    hashes.append((str(candidate), h))
                break

    duplicates = []
    seen = set()
    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            dist = hamming(hashes[i][1], hashes[j][1])
            if dist <= 4:
                pair = tuple(sorted([hashes[i][0], hashes[j][0]]))
                if pair not in seen:
                    seen.add(pair)
                    duplicates.append((hashes[i][0], hashes[j][0], dist))

    return duplicates


def print_distribution(name, counts, total):
    print(f"\n  {name}:")
    max_c = max(counts.values()) if counts else 1
    min_c = min(counts.values()) if counts else 1
    for cid, cname in enumerate(CLASS_NAMES):
        count = counts.get(cid, 0)
        pct = count / total * 100 if total else 0
        bar = "#" * max(1, int(pct / 2.5))
        flag = ""
        if count == max_c:
            flag = " <- MAX"
        elif count == min_c:
            flag = " <- MIN"
        print(f"    {cname:25s} {count:8,} ({pct:5.1f}%) {bar}{flag}")
    return max_c / min_c if min_c > 0 else 999


def print_bbox_stats(label, areas):
    if not areas:
        return
    a = np.array(areas)
    print(f"\n  {label}:")
    print(f"    Mean   : {a.mean():.4f}")
    print(f"    Median : {np.median(a):.4f}")
    print(f"    Min    : {a.min():.4f}")
    print(f"    Max    : {a.max():.4f}")
    tiny = int((a < TINY_THRESH).sum())
    small = int((a < SMALL_THRESH).sum())
    if tiny:
        print(f"    [!]  {tiny} bbox < {TINY_THRESH*100:.1f}% area")
    if small:
        print(f"    [!]  {small} bbox < {SMALL_THRESH*100:.0f}% area")


def main():
    random.seed(42)
    print("=" * 65)
    print("  CHECK DATASET ? JalanKita")
    print("=" * 65)

    total_class = Counter()
    all_areas = []
    all_sizes = defaultdict(list)
    all_aspect = []
    all_resolutions = Counter()

    results = []

    for split in ["train", "valid", "test"]:
        r = check_split(split)
        if r is None:
            print(f"\n[{split.upper()}] ? folder tidak ditemukan")
            continue

        results.append(r)
        total_class += r["class_counter"]
        all_areas += r["bbox_areas"]
        for cid, areas in r["bbox_sizes"].items():
            all_sizes[cid] += areas
        all_aspect += r["aspect_ratios"]
        all_resolutions += r["resolutions"]

        print(f"\n{'='*65}")
        print(f"  [{split.upper()}]")
        print(f"{'='*65}")
        print(f"  Gambar           : {r['n_images']:>8,}")
        print(f"  Label            : {r['n_labels']:>8,}")
        print(f"  Total bbox periksa : {r['total_bboxes']:>8,}")

        issues = []
        if r["missing_labels"]:
                issues.append(f"[?] {r['missing_labels']} gambar tanpa label")
        if r["missing_images"]:
            issues.append(f"[?] {r['missing_images']} label tanpa gambar")
        if r["empty_labels"]:
            issues.append(f"[?] {r['empty_labels']} label kosong (file txt tanpa isi)")
        if r["corrupt_images"]:
            issues.append(f"[!] {r['corrupt_images']} gambar corrupt/tidak bisa dibaca")
        if r["tiny_images"]:
            issues.append(f"[?] {r['tiny_images']} gambar <64px")
        if r["oob_bboxes"]:
            issues.append(f"[!] {r['oob_bboxes']} bbox out-of-bounds (cx/cy/w/h di luar [0,1])")
        if r["edge_bboxes"]:
            issues.append(
                f"[?] {r['edge_bboxes']} bbox terlalu dekat tepi (<{EDGE_MARGIN*100:.0f}% margin)"
            )

        if issues:
            for i in issues:
                print(f"  {i}")
        else:
            print(f"  [OK] Semua bersih")

        total_sampled = sum(r["class_counter"].values()) or 1
        ratio = print_distribution("  Distribusi kelas", r["class_counter"], total_sampled)

        print_bbox_stats("Ukuran bbox", r["bbox_areas"])

        if r["aspect_ratios"]:
            ar = np.array(r["aspect_ratios"])
            print(f"\n  Aspect ratio bbox (w/h):")
            print(f"    Mean   : {ar.mean():.2f}")
            print(f"    Median : {np.median(ar):.2f}")
            tall = int((ar < 0.5).sum())
            wide = int((ar > 2.0).sum())
            if tall:
                print(f"    [!]  {tall} bbox sangat vertikal (<0.5)")
            if wide:
                print(f"    [!]  {wide} bbox sangat horizontal (>2.0)")

    print(f"\n{'='*65}")
    print(f"  RESOLUSI GAMBAR (dari sampel)")
    print(f"{'='*65}")
    for res, cnt in all_resolutions.most_common(10):
        print(f"    {res:>15s} : {cnt:>6,}")

    print(f"\n{'='*65}")
    print(f"  DISTRIBUSI KELAS GABUNGAN")
    print(f"{'='*65}")
    grand_total = sum(total_class.values())
    ratio = print_distribution("", total_class, grand_total)
    print(f"\n  Rasio max/min : {ratio:.1f}x")
    if ratio <= 2:
        print(f"  [OK] Balance baik (rasio < 2x)")
    elif ratio <= 4:
        print(f"  [!]  Cukup seimbang (rasio 2-4x)")
    else:
        print(f"  [BAD] Tidak seimbang (rasio > 4x)")

    print_bbox_stats("Ukuran bbox per kelas", all_areas)
    print(f"\n  Ukuran bbox per kelas:")
    for cid, cname in enumerate(CLASS_NAMES):
        if cid in all_sizes and all_sizes[cid]:
            areas = np.array(all_sizes[cid])
            tiny_n = int((areas < TINY_THRESH).sum())
            small_n = int((areas < SMALL_THRESH).sum())
            print(
                f"    {cname:25s} mean={areas.mean():.4f} med={np.median(areas):.4f}"
                f" min={areas.min():.4f}"
                f" {' [!] tiny' if tiny_n > 0 else ''}{' [!] small' if small_n > 0 else ''}"
            )

    if all_aspect:
        ar_all = np.array(all_aspect)
        print(f"\n  Aspect ratio keseluruhan:")
        print(f"    Mean   : {ar_all.mean():.2f}")
        print(f"    Median : {np.median(ar_all):.2f}")

    print(f"\n{'='*65}")
    print(f"  CEK DATA LEAKAGE (near-duplicate antar split)")
    print(f"{'='*65}")
    splits_to_check = [
        ("train", "valid"),
        ("train", "test"),
        ("valid", "test"),
    ]
    total_leaks = 0
    for s1_name, s2_name in splits_to_check:
        img1_dir = Path(DATASET_PATH) / s1_name / "images"
        img2_dir = Path(DATASET_PATH) / s2_name / "images"
        lbl1_dir = Path(DATASET_PATH) / s1_name / "labels"
        lbl2_dir = Path(DATASET_PATH) / s2_name / "labels"

        if not img1_dir.exists() or not img2_dir.exists():
            continue

        lbl1_files = list(lbl1_dir.glob("*.txt"))
        lbl2_files = list(lbl2_dir.glob("*.txt"))

        dup1 = find_near_duplicates(lbl1_files, img1_dir, PHASH_SAMPLE)
        dup2 = find_near_duplicates(lbl2_files, img2_dir, PHASH_SAMPLE)

        intra_leaks = 0
        for f1_path, f2_path, dist in dup1 + dup2:
            stem1 = Path(f1_path).stem
            stem2 = Path(f2_path).stem
            if stem1[:10] != stem2[:10]:
                continue
            intra_leaks += 1

        cross_leaks = 0
        lbl1_sample = lbl1_files[: min(len(lbl1_files), PHASH_SAMPLE)]
        lbl2_sample = lbl2_files[: min(len(lbl2_files), PHASH_SAMPLE)]

        hashes1 = []
        hashes2 = []

        for lbl_file in lbl1_sample:
            for ext in [".jpg", ".jpeg", ".png"]:
                candidate = img1_dir / (lbl_file.stem + ext)
                if candidate.exists():
                    img = cv2.imread(str(candidate))
                    if img is not None:
                        hashes1.append((str(candidate), dct_based_hash(img)))
                    break

        for lbl_file in lbl2_sample:
            for ext in [".jpg", ".jpeg", ".png"]:
                candidate = img2_dir / (lbl_file.stem + ext)
                if candidate.exists():
                    img = cv2.imread(str(candidate))
                    if img is not None:
                        hashes2.append((str(candidate), dct_based_hash(img)))
                    break

        cross_dups = set()
        for i in range(len(hashes1)):
            for j in range(len(hashes2)):
                dist = hamming(hashes1[i][1], hashes2[j][1])
                if dist <= 4:
                    pair = tuple(sorted([hashes1[i][0], hashes2[j][0]]))
                    cross_dups.add(pair)
                    cross_leaks += 1

        if cross_leaks:
            print(f"  [!]  {s1_name} ? {s2_name}: ~{cross_leaks} gambar mirip")
            total_leaks += cross_leaks
        else:
            print(f"  [OK] {s1_name} ? {s2_name}: tidak ada duplikat terdeteksi")

        if intra_leaks:
            print(f"      [!]  (plus {intra_leaks} duplikat internal di {s1_name})")

    if total_leaks:
        print(f"\n  [!]  Total potensi data leakage: ~{total_leaks} gambar")
    else:
        print(f"\n  [OK] Tidak ada data leakage terdeteksi")

    print(f"\n{'='*65}")
    print(f"  REKOMENDASI")
    print(f"{'='*65}")
    recs = []

    tiny_total = int((np.array(all_areas) < TINY_THRESH).sum()) if all_areas else 0
    small_total = int((np.array(all_areas) < SMALL_THRESH).sum()) if all_areas else 0
    oob_total = sum(r.get("oob_bboxes", 0) for r in results)
    edge_total = sum(r.get("edge_bboxes", 0) for r in results)

    if tiny_total > 50:
        recs.append(
            f"  [TINGGI] Filter {tiny_total} bbox <0.1% area ? kemungkinan noise anotasi,\n"
            f"           tambahkan preprocessing script untuk hapus otomatis."
        )
    if oob_total > 0:
        recs.append(
            f"  [TINGGI] Perbaiki {oob_total} bbox out-of-bounds ? dataset tidak valid."
        )
    if total_leaks > 0:
        recs.append(
            f"  [SEDANG] Data leakage ~{total_leaks} gambar ? split ulang dengan\n"
            f"           deduplikasi berbasis perceptual hash."
        )
    if edge_total > 100:
        recs.append(
            f"  [SEDANG] {edge_total} bbox terlalu dekat tepi ? pertimbangkan padding\n"
            f"           atau hapus bbox dengan margin <5%."
        )
    if ratio > 2:
        recs.append(
            f"  [SEDANG] Class imbalance (rasio {ratio:.1f}x) ? gunakan class_weight\n"
            f"           atau oversampling saat training."
        )

    if all_aspect:
        ar = np.array(all_aspect)
        tall_pct = (ar < 0.5).sum() / len(ar) * 100
        if tall_pct > 5:
            recs.append(
                f"  [RENDAH] {tall_pct:.0f}% bbox sangat vertikal ? augmentasi\n"
                f"           perspective=0.001 bisa membantu generalisasi sudut HP miring."
            )

    recs.append(
        f"  [INFO] Parameter training yang disarankan:\n"
        f"         cos_lr=True, mixup=0.2, copy_paste=0.15,\n"
        f"         scale=0.3, degrees=15, perspective=0.001,\n"
        f"         close_mosaic=15, patience=50, hsv_h=0.05"
    )

    if not recs:
        recs.append(f"  [OK] Dataset siap untuk training tanpa perubahan.")

    for r in recs:
        print(r)
        print()

    print(f"{'='*65}")
    print(f"  SELESAI!")
    print(f"{'='*65}")


if __name__ == "__main__":
    main()
