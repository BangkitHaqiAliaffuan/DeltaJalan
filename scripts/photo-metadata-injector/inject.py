import piexif
import json
import os
import sys
from datetime import datetime, timezone
from fractions import Fraction

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

def _to_dms(deg):
    deg = float(deg)
    d = int(abs(deg))
    m = int((abs(deg) - d) * 60)
    s = round(((abs(deg) - d) * 60 - m) * 60, 4)
    return ((d, 1), (m, 1), (int(s * 100), 100))

def _to_exif_coord(deg, ref):
    dms = _to_dms(deg)
    return (dms, ref)

def _gps_to_exif(lat, lng):
    lat_ref = "N" if lat >= 0 else "S"
    lng_ref = "E" if lng >= 0 else "W"
    return {
        piexif.GPSIFD.GPSLatitudeRef: lat_ref,
        piexif.GPSIFD.GPSLatitude: _to_dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: lng_ref,
        piexif.GPSIFD.GPSLongitude: _to_dms(lng),
        piexif.GPSIFD.GPSVersionID: (2, 3, 0, 0),
    }

def read_metadata(path):
    try:
        exif = piexif.load(path)
    except Exception as e:
        return {"error": f"Gagal baca EXIF: {e}"}

    result = {}
    if "0th" in exif and exif["0th"]:
        for k, v in exif["0th"].items():
            try:
                result[f"0th/{piexif.ImageIFD(k).name}"] = str(v)
            except Exception:
                result[f"0th/{k}"] = str(v)
    if "Exif" in exif and exif["Exif"]:
        for k, v in exif["Exif"].items():
            try:
                result[f"Exif/{piexif.ExifIFD(k).name}"] = str(v)
            except Exception:
                result[f"Exif/{k}"] = str(v)
    if "GPS" in exif and exif["GPS"]:
        for k, v in exif["GPS"].items():
            try:
                result[f"GPS/{piexif.GPSIFD(k).name}"] = str(v)
            except Exception:
                result[f"GPS/{k}"] = str(v)
    return result

def inject(path, out, lat=None, lng=None, dt_str=None, make=None, model=None, randomize_days_ago=None):
    try:
        exif_dict = piexif.load(path)
    except Exception:
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "Thumbnail": None}

    if randomize_days_ago:
        import random
        offset = random.randint(0, 3600 * 24 * randomize_days_ago)
        dt = datetime.now(timezone.utc) - __import__("datetime").timedelta(seconds=offset)
        dt_str = dt.strftime("%Y:%m:%d %H:%M:%S")
        print(f"  random date: {dt_str}")

    if dt_str is None:
        dt_str = datetime.now(timezone.utc).strftime("%Y:%m:%d %H:%M:%S")

    if dt_str:
        exif_dict["0th"][piexif.ImageIFD.DateTime] = dt_str
        exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = dt_str
        exif_dict["Exif"][piexif.ExifIFD.DateTimeDigitized] = dt_str

    if lat is not None and lng is not None:
        gps = _gps_to_exif(lat, lng)
        exif_dict["GPS"].update(gps)

    if make:
        exif_dict["0th"][piexif.ImageIFD.Make] = make
    if model:
        exif_dict["0th"][piexif.ImageIFD.Model] = model

    new_exif = piexif.dump(exif_dict)
    piexif.insert(new_exif, path, out)

def main():
    os.makedirs(OUT, exist_ok=True)

    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help", "help"):
        print("""
Penggunaan:
  python inject.py                              # batch process semua file di source/
  python inject.py "file.jpg"                   # process satu file
  python inject.py "file.jpg" "output.jpg"      # process dengan output tertentu

Argumen env (via file .env atau inline):
  LAT=-7.33             lintang (desimal)
  LNG=112.74            bujur (desimal)
  DATE=2025:06:15 10:30:00   tanggal EXIF (format EXIF: Y:m:d H:M:S)
  MAKE="Samsung"        nama manufacturer
  MODEL="Galaxy S24"    nama model
  RANDOM_DAYS=7         randomize tanggal dalam N hari terakhir

Contoh:
  # inject GPS + date ke semua file di source/
  set LAT=-7.33 && set LNG=112.74 && set DATE="2025:06:15 10:30:00" && python inject.py

  # batch randomize date 7 hari terakhir
  set RANDOM_DAYS=7 && python inject.py

  # read metadata
  python inject.py --read "foto.jpg"
""".strip())
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--read":
        if len(sys.argv) < 3:
            print("Gunakan: python inject.py --read <file>")
            return
        meta = read_metadata(sys.argv[2])
        print(json.dumps(meta, indent=2, ensure_ascii=False))
        return

    lat = os.environ.get("LAT")
    lng = os.environ.get("LNG")
    dt_str = os.environ.get("DATE")
    make = os.environ.get("MAKE")
    model = os.environ.get("MODEL")
    random_days = os.environ.get("RANDOM_DAYS")

    if lat is not None:
        lat = float(lat)
    if lng is not None:
        lng = float(lng)
    if random_days is not None:
        random_days = int(random_days)

    if len(sys.argv) >= 2 and not sys.argv[1].startswith("--"):
        src_path = sys.argv[1]
        out_path = sys.argv[2] if len(sys.argv) >= 3 else os.path.join(OUT, os.path.basename(src_path))
        os.makedirs(os.path.dirname(out_path) or OUT, exist_ok=True)
        print(f"Memproses: {src_path}")
        inject(src_path, out_path, lat, lng, dt_str, make, model, random_days)
        print(f"  -> {out_path}")
        print("Selesai.")
        return

    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    if not files:
        print(f"Tidak ada file gambar di:\n  {SRC}")
        sys.exit(1)

    print(f"Source: {SRC}")
    print(f"Output: {OUT}")
    if lat is not None and lng is not None:
        print(f"GPS   : {lat}, {lng}")
    if dt_str:
        print(f"Date  : {dt_str}")
    if make:
        print(f"Make  : {make}")
    if model:
        print(f"Model : {model}")
    if random_days:
        print(f"Random: {random_days} hari ke belakang")
    print(f"Files : {len(files)}")
    print()

    ok = 0
    skip = 0
    for fname in files:
        src = os.path.join(SRC, fname)
        if not os.path.isfile(src):
            skip += 1
            print(f"  SKIP {fname} — bukan file biasa")
            continue
        out = os.path.join(OUT, fname)
        try:
            inject(src, out, lat, lng, dt_str, make, model, random_days)
            print(f"  OK  {fname}")
            ok += 1
        except Exception as e:
            print(f"  SKIP {fname} — {e}")
            skip += 1

    print(f"\nSelesai: {ok} OK, {skip} skip/gagal")

if __name__ == "__main__":
    main()
