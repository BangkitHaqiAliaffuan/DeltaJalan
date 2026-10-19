"""Set tanggal EXIF semua foto di original/ ke (sekarang - 5 jam).

- Hanya update 3 tag tanggal (DateTime, DateTimeOriginal, DateTimeDigitized).
- GPS dan tag lain dipertahankan apa adanya (copy-through via piexif.load).
- File asli TIDAK ditimpa; output: <nama>_fresh.jpg di subfolder fresh/.
  Struktur folder (relatif ke "Image For Testing/"):
    original/  foto sumber (input script ini)
    fresh/     foto EXIF-fresh (output script ini)
    analyze/   respons JSON mentah /analyze
    detected/  gambar teranotasi hasil decode image_result
- Prioritas baca Laravel: DateTimeOriginal -> DateTimeDigitized -> DateTime
  (AIController.php / ReportController.php), jadi ketiganya di-set.

Penggunaan:
    python3 scripts/set-exif-today-minus5h.py
"""

import os
import sys
from datetime import datetime, timedelta

import piexif

BASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Image For Testing",
)
SRC_DIR = os.path.join(BASE_DIR, "original")
OUT_DIR = os.path.join(BASE_DIR, "fresh")

# Ekstensi yang didukung piexif (JPEG/TIFF saja — PNG/WebP tidak bisa disisipi EXIF).
SUPPORTED_EXTS = (".jpg", ".jpeg")


def discover_files(src_dir: str) -> list:
    """Pindai semua file gambar yang didukung di src_dir (urut alfabetis).

    Melewati file `*_fresh.*` agar aman bila SRC_DIR keliru menunjuk ke fresh/.
    """
    return sorted(
        f
        for f in os.listdir(src_dir)
        if f.lower().endswith(SUPPORTED_EXTS)
        and os.path.isfile(os.path.join(src_dir, f))
        and not os.path.splitext(f)[0].lower().endswith("_fresh")
    )


def fresh_exif_date() -> str:
    target = datetime.now() - timedelta(hours=5)
    return target.strftime("%Y:%m:%d %H:%M:%S")


def set_date(src: str, dst: str, dt_str: str) -> dict:
    try:
        exif_dict = piexif.load(src)
    except Exception:
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "Thumbnail": None}

    exif_dict["0th"][piexif.ImageIFD.DateTime] = dt_str
    exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = dt_str
    exif_dict["Exif"][piexif.ExifIFD.DateTimeDigitized] = dt_str

    piexif.insert(piexif.dump(exif_dict), src, dst)

    # Baca-balik untuk verifikasi (piexif mengembalikan bytes → decode dulu)
    check = piexif.load(dst)

    def _s(v):
        return v.decode("utf-8", "replace") if isinstance(v, bytes) else v
    return {
        "DateTime": _s(check["0th"].get(piexif.ImageIFD.DateTime)),
        "DateTimeOriginal": _s(check["Exif"].get(piexif.ExifIFD.DateTimeOriginal)),
        "DateTimeDigitized": _s(check["Exif"].get(piexif.ExifIFD.DateTimeDigitized)),
        "gps_preserved": bool(check["GPS"]),
    }


def main() -> int:
    dt_str = fresh_exif_date()
    print(f"Target tanggal EXIF (now - 5h): {dt_str}\n")

    if not os.path.isdir(SRC_DIR):
        print(f"Folder sumber tidak ditemukan: {SRC_DIR}")
        return 1

    files = discover_files(SRC_DIR)
    if not files:
        print(f"Tidak ada file gambar (.jpg/.jpeg) di {SRC_DIR}.")
        return 1

    print(f"Ditemukan {len(files)} file di {SRC_DIR}.\n")

    ok = 0
    os.makedirs(OUT_DIR, exist_ok=True)
    for fname in files:
        src = os.path.join(SRC_DIR, fname)
        base, ext = os.path.splitext(fname)
        dst = os.path.join(OUT_DIR, f"{base}_fresh{ext}")
        try:
            verif = set_date(src, dst, dt_str)
            status = "OK " if all(v == dt_str for k, v in verif.items() if k != "gps_preserved") else "CEK"
            print(f"  [{status}] {fname} -> {os.path.basename(dst)}")
            print(f"         verifikasi: {verif}")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  [GAGAL] {fname}: {e}")

    print(f"\nSelesai: {ok}/{len(files)} berhasil.")
    return 0 if ok == len(files) else 1


if __name__ == "__main__":
    sys.exit(main())
