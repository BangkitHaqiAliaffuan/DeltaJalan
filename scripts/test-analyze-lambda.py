"""Testing POST /analyze ke Lambda AI untuk foto-foto di fresh/.

- Health check GET / dulu, lalu POST multipart field `file` per foto.
- Respons mentah (termasuk image_result base64) disimpan ke analyze/,
  gambar teranotasi hasil decode disimpan ke detected/.
  Struktur folder (relatif ke "Image For Testing/"):
    original/  foto sumber
    fresh/     foto EXIF-fresh (input script ini)
    analyze/   analyze_<nama>.json (output script ini)
    detected/  detected_<nama>.jpg (output script ini)
"""

import base64
import glob
import json
import os
import sys

import requests

LAMBDA_URL = os.environ.get(
    "LAMBDA_URL",
    "https://sxhryovsbl4g6kbsvageizvane0tiqat.lambda-url.ap-southeast-1.on.aws",
).rstrip("/")

BASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Image For Testing",
)
SRC_DIR = os.path.join(BASE_DIR, "fresh")
JSON_DIR = os.path.join(BASE_DIR, "analyze")
IMG_DIR = os.path.join(BASE_DIR, "detected")


def main() -> int:
    try:
        h = requests.get(f"{LAMBDA_URL}/", timeout=20)
        print(f"Health: HTTP {h.status_code} -> {h.text[:200]}")
        h.raise_for_status()
    except Exception as e:  # noqa: BLE001
        print(f"Health check GAGAL: {e}")
        return 1

    files = sorted(glob.glob(os.path.join(SRC_DIR, "*_fresh.jpg")))
    if not files:
        print("Tidak ada file *_fresh.jpg")
        return 1

    summary = []
    os.makedirs(JSON_DIR, exist_ok=True)
    os.makedirs(IMG_DIR, exist_ok=True)
    for path in files:
        name = os.path.basename(path)
        stem = os.path.splitext(name)[0]
        out = os.path.join(JSON_DIR, f"analyze_{stem}.json")
        img_out = os.path.join(IMG_DIR, f"detected_{stem}.jpg")
        try:
            with open(path, "rb") as fh:
                # Timeout 120s: antisipasi cold start Lambda (3-6s) + inferensi ensemble
                r = requests.post(
                    f"{LAMBDA_URL}/analyze",
                    files={"file": (name, fh, "image/jpeg")},
                    timeout=120,
                )
            try:
                data = r.json()
            except Exception:
                data = {"_non_json_body": r.text[:500]}
            with open(out, "w") as fh:
                json.dump({"http": r.status_code, "response": data}, fh)
            # Decode gambar teranotasi (jika ada) ke detected/
            b64 = data.get("image_result", "") if isinstance(data, dict) else ""
            if b64:
                with open(img_out, "wb") as fh:
                    fh.write(base64.b64decode(b64))
            dets = data.get("detections", []) if isinstance(data, dict) else []
            det_str = ", ".join(
                f"{d.get('class_name', d.get('class'))}@{d.get('confidence', 0):.2f}"
                for d in dets
            ) or "-"
            line = (
                f"[{r.status_code}] {name}: status={data.get('status')}, "
                f"total={data.get('total')}, severity={data.get('overall_severity')} "
                f"(score={data.get('severity_score')}), deteksi=[{det_str}]"
            )
            print(line)
            summary.append(line)
        except Exception as e:  # noqa: BLE001
            print(f"[ERR] {name}: {e}")

    print(f"\nJSON mentah -> {JSON_DIR}/analyze_*.json")
    print(f"Gambar teranotasi -> {IMG_DIR}/detected_*.jpg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
