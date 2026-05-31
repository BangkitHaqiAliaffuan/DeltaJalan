"""
merge_dataset.py — JalanKita Sidoarjo
Menyatukan 3 dataset YOLOv8 dengan kelas berbeda → 3 kelas target

CARA PAKAI:
1. Simpan file ini di folder manapun (misal: C:/jalankita/)
2. Edit bagian KONFIGURASI di bawah (isi path dataset kamu)
3. Buka CMD / Terminal → jalankan: python merge_dataset.py
4. Hasilnya ada di folder output_dir yang kamu tentukan

KEBUTUHAN:
  pip install pyyaml
"""

import os
import shutil
import random
import yaml
from pathlib import Path


# ============================================================
#  !! KONFIGURASI — EDIT BAGIAN INI SESUAI FOLDER KAMU !!
# ============================================================

# Path ke masing-masing folder dataset (yang berisi train/, valid/, test/)
# Contoh Windows: r"C:\Users\NamaKamu\Downloads\dataset1"
DATASETS = [
    {
        "name": "merged_lama",        # nama bebas, untuk log saja
        "path": r"C:\jalankita\dataset_mergedV4",   # <-- ganti ini
    },
    {"name": "lubang_kecil",
    "path": r"C:\Users\Haqii\Downloads\road damage v2i"},
    {"name": "retak_buaya",
    "path": r"C:\Users\Haqii\Downloads\road danage dataset v2i"},
]

# Folder hasil merge (akan dibuat otomatis)
OUTPUT_DIR = r"C:\jalankita\dataset_mergedV4"  # <-- ganti ini jika perlu

# Rasio split (harus total = 1.0)
TRAIN_RATIO = 0.80
VALID_RATIO = 0.10
TEST_RATIO  = 0.10

# ============================================================
#  MAPPING KELAS — sesuaikan setelah lihat output "KELAS TERDETEKSI"
# ============================================================
# Format: "nama_kelas_di_dataset_asli": id_kelas_target
#   0 = lubang_besar
#   1 = lubang_kecil
#   2 = retak_kulit_buaya
#  -1 = ABAIKAN (kelas ini tidak akan disertakan)
#
# Script akan mencetak semua kelas yang ditemukan — edit mapping ini
# setelah melihat outputnya, lalu jalankan ulang.

CLASS_MAPPING = {
    # === lubang_besar (0) ===
    "pothole":              0,
    "Pothole":              0,
    "potholes":             0,
    "Potholes":             0,
    "lubang_besar":         0,
    "lubang besar":         0,
    "D10":                  0,
    "berlubang besar":      0,
    "Large Pothole":        0,

    # === lubang_kecil (1) ===
    "lubang_kecil":         1,
    "lubang kecil":         1,
    "Minimum_Damage":1,
    "small_pothole":        1,
    "small pothole":        1,
    "Small Pothole":        1,
    "berlubang":            1,
    "berlubang kecil":      1,
    # Retak panjang 
     "retak_panjang":         3,
     "retak_memanjang":         3,
     "Retak_memanjang":         3,
    "longitudinal cracking": 3,
    "Longitudinal-Crack":    3,
    "lateral cracking":     -1,
    "Lateral-Crack":        -1,

    # === retak_kulit_buaya (2) ===
    "alligator_crack":      2,
    "Alligator":            2,
    "retak_buaya":          2,
    "alligator crack":      2,
    "alligator cracking":   2,
    "alligator_cracking":   2,
    "Retak_kulit_buaya":    2,
    "retak_kulit_buaya":    2,
    "D20":                  2,
    "crocodile_crack":      2,
    "crocodile crack":      2,

    # === ABAIKAN (-1) ===
    "longitudinal_crack":  -1,
    "longitudinal crack":  -1,
    "transverse_crack":    -1,
    "transverse crack":    -1,
    "rutting":             -1,
    "bleeding":            -1,
    "raveling":            -1,
    "D00":                 -1,
    "D01":                 -1,
    "D10_small":           -1,
    "D40":                 -1,
    "D43":                 -1,
    "D44":                 -1,
    "repair":              -1,
}

TARGET_CLASSES = ["lubang_besar", "lubang_kecil", "retak_kulit_buaya", "retak_memanjang"]

# ============================================================


def load_yaml_classes(dataset_path: str) -> list:
    """Baca nama kelas dari data.yaml di dalam folder dataset."""
    dataset_path = Path(dataset_path)
    for yaml_name in ["data.yaml", "data.yml", "_darknet.labels"]:
        yaml_file = dataset_path / yaml_name
        if yaml_file.exists():
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return data.get("names", [])
    return []


def find_image_label_pairs(dataset_path: str) -> list:
    """
    Cari semua pasangan (image, label) di dalam folder dataset.
    Mendukung struktur: train/images + train/labels, valid/images + valid/labels, dll.
    """
    dataset_path = Path(dataset_path)
    pairs = []

    # Coba struktur standar Roboflow: train/ valid/ test/
    for split in ["train", "valid", "test"]:
        img_dir = dataset_path / split / "images"
        lbl_dir = dataset_path / split / "labels"
        if img_dir.exists() and lbl_dir.exists():
            for img_file in img_dir.iterdir():
                if img_file.suffix.lower() in [".jpg", ".jpeg", ".png"]:
                    lbl_file = lbl_dir / (img_file.stem + ".txt")
                    if lbl_file.exists():
                        pairs.append((img_file, lbl_file))

    # Fallback: cari images/ dan labels/ langsung di root
    if not pairs:
        img_dir = dataset_path / "images"
        lbl_dir = dataset_path / "labels"
        if img_dir.exists() and lbl_dir.exists():
            for img_file in img_dir.iterdir():
                if img_file.suffix.lower() in [".jpg", ".jpeg", ".png"]:
                    lbl_file = lbl_dir / (img_file.stem + ".txt")
                    if lbl_file.exists():
                        pairs.append((img_file, lbl_file))

    return pairs


def convert_label_file(src_label: Path, dst_label: Path, src_classes: list,
                        mapping: dict, unknown_classes: set) -> bool:
    """
    Baca file label asli, konversi class id sesuai mapping, simpan ke dst.
    Return True jika ada minimal 1 baris valid.
    """
    lines_out = []
    with open(src_label, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 5:
                continue

            old_id = int(parts[0])
            if old_id >= len(src_classes):
                continue

            class_name = src_classes[old_id]

            if class_name not in mapping:
                unknown_classes.add(class_name)
                continue

            new_id = mapping[class_name]
            if new_id == -1:
                continue  # sengaja diabaikan

            # Tulis ulang dengan new_id
            lines_out.append(f"{new_id} " + " ".join(parts[1:]))

    if lines_out:
        dst_label.parent.mkdir(parents=True, exist_ok=True)
        with open(dst_label, "w") as f:
            f.write("\n".join(lines_out) + "\n")
        return True
    return False


def main():
    random.seed(42)
    output_dir = Path(OUTPUT_DIR)

    print("=" * 60)
    print("  JalanKita — Merge Dataset YOLOv8")
    print("=" * 60)

    # ── Tahap 1: Scan semua kelas yang ada ──────────────────────
    print("\n[1/4] Membaca kelas dari setiap dataset...")
    all_found_classes = set()
    dataset_info = []

    for ds in DATASETS:
        path = ds["path"]
        name = ds["name"]
        classes = load_yaml_classes(path)
        pairs   = find_image_label_pairs(path)
        dataset_info.append({"name": name, "path": path,
                              "classes": classes, "pairs": pairs})
        all_found_classes.update(classes)
        print(f"\n  [{name}]")
        print(f"    Path    : {path}")
        print(f"    Kelas   : {classes}")
        print(f"    Gambar  : {len(pairs)} pasang image+label")

    print("\n" + "─" * 60)
    print("  SEMUA KELAS YANG TERDETEKSI:")
    for c in sorted(all_found_classes):
        mapped = CLASS_MAPPING.get(c)
        if mapped is None:
            status = "⚠️  BELUM ADA DI MAPPING — tambahkan ke CLASS_MAPPING!"
        elif mapped == -1:
            status = "✗  diabaikan"
        else:
            status = f"✓  → {TARGET_CLASSES[mapped]}"
        print(f"    {c:35s} {status}")
    print("─" * 60)

    # ── Tahap 2: Kumpulkan semua pasang file ────────────────────
    print("\n[2/4] Mengumpulkan semua gambar & label...")
    all_pairs = []  # list of (img_path, lbl_path, src_classes)
    for ds_info in dataset_info:
        for img, lbl in ds_info["pairs"]:
            all_pairs.append((img, lbl, ds_info["classes"]))

    print(f"  Total pasang: {len(all_pairs)}")

    # Acak dan split
    random.shuffle(all_pairs)
    n = len(all_pairs)
    n_train = int(n * TRAIN_RATIO)
    n_valid = int(n * VALID_RATIO)
    splits = {
        "train": all_pairs[:n_train],
        "valid": all_pairs[n_train:n_train + n_valid],
        "test":  all_pairs[n_train + n_valid:],
    }
    for split, pairs in splits.items():
        print(f"    {split:5s} : {len(pairs)} gambar")

    # ── Tahap 3: Konversi & salin ────────────────────────────────
    print("\n[3/4] Mengkonversi label & menyalin file...")
    unknown_classes = set()
    stats = {s: {"ok": 0, "skip": 0} for s in splits}

    # Penghitung per-kelas: {split: {class_id: {"images": int, "instances": int}}}
    from collections import defaultdict
    class_counts = {
        split: {i: {"images": 0, "instances": 0} for i in range(len(TARGET_CLASSES))}
        for split in splits
    }

    for split, pairs in splits.items():
        img_out = output_dir / split / "images"
        lbl_out = output_dir / split / "labels"
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)

        for i, (img_path, lbl_path, src_classes) in enumerate(pairs):
            # Beri nama unik agar tidak tabrakan antar dataset
            stem = f"img_{split}_{i:05d}"
            dst_img = img_out / (stem + img_path.suffix)
            dst_lbl = lbl_out / (stem + ".txt")

            ok = convert_label_file(lbl_path, dst_lbl, src_classes,
                                    CLASS_MAPPING, unknown_classes)
            if ok:
                # Skip copy jika src == dst (terjadi jika OUTPUT_DIR sama dengan salah satu DATASETS path)
                if img_path.resolve() != dst_img.resolve():
                    shutil.copy2(img_path, dst_img)
                stats[split]["ok"] += 1

                # Hitung class per image dari label yang sudah ditulis
                with open(dst_lbl, "r") as lf:
                    class_ids_in_image = set()
                    for lbl_line in lf:
                        lbl_line = lbl_line.strip()
                        if not lbl_line:
                            continue
                        cid = int(lbl_line.split()[0])
                        class_counts[split][cid]["instances"] += 1
                        class_ids_in_image.add(cid)
                    for cid in class_ids_in_image:
                        class_counts[split][cid]["images"] += 1
            else:
                stats[split]["skip"] += 1

        print(f"  {split:5s}: {stats[split]['ok']} disalin, "
              f"{stats[split]['skip']} dilewati (tidak ada kelas target)")

    # ── Tahap 4: Buat data.yaml ──────────────────────────────────
    print("\n[4/4] Membuat data.yaml...")

    # Gunakan path absolut agar tidak error di Colab/Windows
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

    print(f"  Tersimpan di: {yaml_path}")

    # ── Ringkasan ────────────────────────────────────────────────
    total_ok = sum(s["ok"] for s in stats.values())
    total_skip = sum(s["skip"] for s in stats.values())

    print("\n" + "=" * 60)
    print("  SELESAI!")
    print("=" * 60)
    print(f"  Total gambar berhasil : {total_ok}")
    print(f"  Total dilewati        : {total_skip}")
    print(f"  Output folder         : {output_dir}")
    print(f"  data.yaml             : {yaml_path}")

    # ── Tabel distribusi per kelas ────────────────────────────────
    print("\n" + "=" * 60)
    print("  DISTRIBUSI IMAGE PER KELAS (setelah merge & split)")
    print("=" * 60)
    col_w = 22
    header = f"  {'Kelas':{col_w}s}" + "".join(
        f"{'train':>12s}" if s == "train" else
        f"{'valid':>12s}" if s == "valid" else
        f"{'test':>12s}"
        for s in ["train", "valid", "test"]
    ) + f"{'TOTAL':>12s}"
    print(header)
    print("  " + "─" * (col_w + 12 * 4))

    grand_img   = 0
    grand_inst  = 0
    for cid, cname in enumerate(TARGET_CLASSES):
        row = f"  {cname:{col_w}s}"
        total_img_class  = 0
        total_inst_class = 0
        for split in ["train", "valid", "test"]:
            imgs  = class_counts[split][cid]["images"]
            insts = class_counts[split][cid]["instances"]
            row += f"{imgs:>6d} img{insts:>6d} ins"
            # Hanya hitung train untuk grand total (agar tidak bias)
            total_img_class  += imgs
            total_inst_class += insts
        row += f"{total_img_class:>6d} img"
        print(row)
        grand_img  += class_counts["train"][cid]["images"]
        grand_inst += class_counts["train"][cid]["instances"]

    print("  " + "─" * (col_w + 12 * 4))
    # Baris total per split
    row_total = f"  {'TOTAL (train)':{col_w}s}"
    for split in ["train", "valid", "test"]:
        total_imgs  = sum(class_counts[split][c]["images"]  for c in range(len(TARGET_CLASSES)))
        total_insts = sum(class_counts[split][c]["instances"] for c in range(len(TARGET_CLASSES)))
        row_total += f"{total_imgs:>6d} img{total_insts:>6d} ins"
    print(row_total)
    print("  " + "─" * (col_w + 12 * 4))
    print("  Catatan: 1 image bisa mengandung >1 kelas (multi-label).")
    print("           'img' = jumlah gambar unik; 'ins' = total bounding box.")

    if unknown_classes:
        print(f"\n  ⚠️  KELAS TIDAK DIKENAL (belum ada di CLASS_MAPPING):")
        for c in sorted(unknown_classes):
            print(f"     - {c}")
        print("  → Tambahkan kelas ini ke CLASS_MAPPING lalu jalankan ulang!")
    else:
        print("\n  ✅ Semua kelas berhasil dimapping. Siap untuk training!")

    print("\n  Isi data.yaml yang dihasilkan:")
    print("  " + "─" * 40)
    with open(yaml_path) as f:
        for line in f:
            print("  " + line, end="")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
