"""
fix_dataset.py — JalanKita Dataset Cleaner
==========================================
Memperbaiki dataset YOLOv8 dengan langkah berurutan:

  TAHAP 1 — Buang bbox out-of-bounds (cx/cy/w/h di luar [0,1])
  TAHAP 2 — Buang bbox terlalu kecil (area < MIN_BBOX_AREA)
  TAHAP 3 — Buang label kosong (file txt tanpa isi valid)
  TAHAP 5 — Split ulang bersih (80/10/10) dengan shuffle + stratifikasi

(Deduplikasi perceptual hash di-skip karena terlalu lambat untuk 13k gambar)

KEBUTUHAN:
  pip install pillow pyyaml tqdm

CARA PAKAI:
  1. Edit DATASET_DIR di bawah
  2. python fix_dataset.py
  3. Dataset bersih tersimpan di OUTPUT_DIR
"""

import os
import shutil
import random
import yaml
from pathlib import Path
from collections import defaultdict

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ============================================================
#  !! KONFIGURASI — EDIT SESUAI PATH KAMU !!
# ============================================================

DATASET_DIR = r"C:\jalankita dataset\dataset_balanced_clean"   # folder dataset asli
OUTPUT_DIR  = r"C:\jalankita dataset\dataset_final"  # folder output bersih (BEDA dari input!)

# Threshold pembersihan
MIN_BBOX_AREA    = 0.001   # buang bbox jika area (w*h) < 0.1% gambar

# Rasio split ulang
TRAIN_RATIO = 0.80
VALID_RATIO = 0.10
TEST_RATIO  = 0.10

# Kelas target (harus sesuai data.yaml lama)
TARGET_CLASSES = ["lubang_besar", "lubang_kecil", "retak_kulit_buaya", "retak_memanjang"]

# ============================================================

SPLITS = ["train", "valid", "test"]

def iter_pairs(dataset_dir: Path):
    """Yield (img_path, lbl_path) untuk semua split."""
    for split in SPLITS:
        img_dir = dataset_dir / split / "images"
        lbl_dir = dataset_dir / split / "labels"
        if not img_dir.exists():
            continue
        for img in img_dir.iterdir():
            if img.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            lbl = lbl_dir / (img.stem + ".txt")
            if lbl.exists():
                yield img, lbl

def progress(iterable, desc="", total=None):
    if HAS_TQDM:
        return tqdm(iterable, desc=desc, total=total, ncols=80)
    return iterable

# ──────────────────────────────────────────────────────────────
# TAHAP 1+2+3 : Bersihkan bbox + label kosong
# ──────────────────────────────────────────────────────────────

def clean_label(lbl_path: Path, stats: dict) -> list:
    clean_lines = []
    try:
        with open(lbl_path, "r", encoding="utf-8") as f:
            raw_lines = f.readlines()
    except Exception:
        stats["read_error"] += 1
        return []

    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 5:
            stats["malformed"] += 1
            continue

        try:
            cls_id = int(parts[0])
            cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        except ValueError:
            stats["malformed"] += 1
            continue

        if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
            stats["oob"] += 1
            continue

        area = w * h
        if area < MIN_BBOX_AREA:
            stats["tiny"] += 1
            continue

        clean_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")

    return clean_lines


def stage_clean(dataset_dir: Path, temp_dir: Path):
    print("\n" + "=" * 65)
    print("  TAHAP 1-3: Pembersihan bbox (OOB, tiny) & label kosong")
    print("=" * 65)

    stats = defaultdict(int)
    kept, dropped = 0, 0

    all_pairs = list(iter_pairs(dataset_dir))
    for img_path, lbl_path in progress(all_pairs, desc="  Cleaning", total=len(all_pairs)):
        split = img_path.parts[-3]
        clean = clean_label(lbl_path, stats)
        if not clean:
            stats["empty_after_clean"] += 1
            dropped += 1
            continue

        dst_img = temp_dir / split / "images" / img_path.name
        dst_lbl = temp_dir / split / "labels" / lbl_path.name
        dst_img.parent.mkdir(parents=True, exist_ok=True)
        dst_lbl.parent.mkdir(parents=True, exist_ok=True)

        if img_path.resolve() != dst_img.resolve():
            shutil.copy2(img_path, dst_img)
        with open(dst_lbl, "w", encoding="utf-8") as f:
            f.write("\n".join(clean) + "\n")
        kept += 1

    print(f"\n  Input gambar     : {len(all_pairs):,}")
    print(f"  Dibuang (OOB)    : {stats['oob']:,} bbox")
    print(f"  Dibuang (tiny)   : {stats['tiny']:,} bbox")
    print(f"  Dibuang (malform): {stats['malformed']:,} bbox")
    print(f"  Gambar tersisa   : {kept:,}  (dibuang: {dropped:,} gambar kosong)")
    return temp_dir


# ──────────────────────────────────────────────────────────────
# TAHAP 5 : Split ulang bersih (skip dedup — terlalu lambat)
# ──────────────────────────────────────────────────────────────

def get_dominant_class(lbl_path: Path) -> int:
    counts = defaultdict(int)
    try:
        with open(lbl_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if parts:
                    counts[int(parts[0])] += 1
    except Exception:
        pass
    if not counts:
        return -1
    return max(counts, key=counts.get)


def stage_split(temp_dir: Path, output_dir: Path):
    print("\n" + "=" * 65)
    print("  TAHAP 5: Split ulang dataset bersih")
    print(f"  Rasio: train={TRAIN_RATIO:.0%} / valid={VALID_RATIO:.0%} / test={TEST_RATIO:.0%}")
    print("=" * 65)

    # Kumpulkan semua gambar + kelas dominan
    all_imgs = []
    for split in SPLITS:
        img_dir = temp_dir / split / "images"
        if img_dir.exists():
            for img in img_dir.iterdir():
                if img.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                    all_imgs.append(img)

    # Kelompokkan per kelas dominan (stratifikasi)
    by_class = defaultdict(list)
    for img_path in progress(all_imgs, desc="  Stratify", total=len(all_imgs)):
        lbl_path = temp_dir / img_path.parts[-3] / "labels" / (img_path.stem + ".txt")
        dominant = get_dominant_class(lbl_path)
        by_class[dominant].append(img_path)

    random.seed(42)
    splits_result = {"train": [], "valid": [], "test": []}

    for cls_id, imgs in by_class.items():
        random.shuffle(imgs)
        n = len(imgs)
        n_train = int(n * TRAIN_RATIO)
        n_valid = int(n * VALID_RATIO)
        splits_result["train"].extend(imgs[:n_train])
        splits_result["valid"].extend(imgs[n_train:n_train + n_valid])
        splits_result["test"].extend(imgs[n_train + n_valid:])

    for split, imgs in splits_result.items():
        img_out = output_dir / split / "images"
        lbl_out = output_dir / split / "labels"
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)

        for img_path in progress(imgs, desc=f"  {split:5s}", total=len(imgs)):
            # Cari label di temp_dir
            src_split = img_path.parts[-3]
            lbl_path = temp_dir / src_split / "labels" / (img_path.stem + ".txt")
            shutil.copy2(img_path, img_out / img_path.name)
            if lbl_path.exists():
                shutil.copy2(lbl_path, lbl_out / (img_path.stem + ".txt"))

        print(f"  {split:5s}: {len(imgs):,} gambar")

    return splits_result


# ──────────────────────────────────────────────────────────────
# Buat data.yaml
# ──────────────────────────────────────────────────────────────

def write_yaml(output_dir: Path):
    yaml_content = {
        "path": str(output_dir.resolve()),
        "train": "train/images",
        "val":   "valid/images",
        "test":  "test/images",
        "nc":    len(TARGET_CLASSES),
        "names": TARGET_CLASSES,
    }
    yaml_path = output_dir / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(yaml_content, f, default_flow_style=False, allow_unicode=True)
    print(f"\n  data.yaml tersimpan -> {yaml_path}")
    return yaml_path


# ──────────────────────────────────────────────────────────────
# Laporan akhir distribusi kelas
# ──────────────────────────────────────────────────────────────

def print_class_report(output_dir: Path):
    print("\n" + "=" * 65)
    print("  DISTRIBUSI KELAS FINAL")
    print("=" * 65)
    print(f"  {'Kelas':<22} {'Train':>8} {'Valid':>8} {'Test':>8} {'Total':>8}")
    print("  " + "-" * 56)

    totals = defaultdict(int)
    for split in SPLITS:
        lbl_dir = output_dir / split / "labels"
        if not lbl_dir.exists():
            continue
        for lbl in lbl_dir.iterdir():
            if lbl.suffix != ".txt":
                continue
            with open(lbl, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if parts:
                        key = (split, int(parts[0]))
                        totals[key] += 1

    for cid, cname in enumerate(TARGET_CLASSES):
        tr = totals.get(("train", cid), 0)
        vl = totals.get(("valid", cid), 0)
        te = totals.get(("test",  cid), 0)
        print(f"  {cname:<22} {tr:>8,} {vl:>8,} {te:>8,} {tr+vl+te:>8,}")

    print("  " + "-" * 56)
    tr_tot = sum(totals.get(("train", c), 0) for c in range(len(TARGET_CLASSES)))
    vl_tot = sum(totals.get(("valid", c), 0) for c in range(len(TARGET_CLASSES)))
    te_tot = sum(totals.get(("test",  c), 0) for c in range(len(TARGET_CLASSES)))
    print(f"  {'TOTAL (bbox)':<22} {tr_tot:>8,} {vl_tot:>8,} {te_tot:>8,} {tr_tot+vl_tot+te_tot:>8,}")


# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────

def main():
    dataset_dir = Path(DATASET_DIR)
    output_dir  = Path(OUTPUT_DIR)
    work_dir    = dataset_dir.parent / "_fix_work"

    if output_dir.resolve() == dataset_dir.resolve():
        print("[ERROR] OUTPUT_DIR dan DATASET_DIR tidak boleh sama!")
        return

    for d in [work_dir, output_dir]:
        if d.exists():
            shutil.rmtree(d)

    print("\n" + "=" * 65)
    print("  JalanKita — Dataset Fixer")
    print("=" * 65)
    print(f"  Input  : {dataset_dir}")
    print(f"  Output : {output_dir}")
    print(f"  Work   : {work_dir}")
    print(f"  Threshold bbox kecil : area < {MIN_BBOX_AREA:.4f} (= {MIN_BBOX_AREA*100:.2f}%)")

    temp_dir = work_dir / "cleaned"
    temp_dir.mkdir(parents=True, exist_ok=True)

    stage_clean(dataset_dir, temp_dir)
    stage_split(temp_dir, output_dir)

    shutil.rmtree(work_dir)

    write_yaml(output_dir)
    print_class_report(output_dir)

    print("\n" + "=" * 65)
    print("  SELESAI! Dataset bersih tersimpan di:")
    print(f"  {output_dir}")
    print("=" * 65)


if __name__ == "__main__":
    main()
