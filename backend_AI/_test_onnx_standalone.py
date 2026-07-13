"""
Test script: verifikasi best.onnx dan best_stable.onnx bisa dipakai
via onnxruntime SAJA (tanpa ultralytics/torch) — simulasi Lambda environment.

Jalankan: python _test_onnx_standalone.py
"""

import os
import sys
import time
import numpy as np
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

def test_onnxruntime_import():
    try:
        import onnxruntime as ort
        print(f"[OK] onnxruntime versi: {ort.__version__}")
        return ort
    except ImportError:
        print("[FAIL] onnxruntime tidak terinstall. Jalankan: pip install onnxruntime")
        sys.exit(1)

def test_load_model(ort, model_path: Path):
    print(f"\n--- Memuat model: {model_path.name} ({model_path.stat().st_size / 1024 / 1024:.1f} MB) ---")
    t0 = time.time()
    try:
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        elapsed = time.time() - t0
        print(f"[OK] Model berhasil dimuat dalam {elapsed:.2f}s")
        
        # Info input/output
        inp = session.get_inputs()[0]
        out = session.get_outputs()[0]
        print(f"     Input : {inp.name}, shape={inp.shape}, type={inp.type}")
        print(f"     Output: {out.name}, shape={out.shape}, type={out.type}")
        return session
    except Exception as e:
        print(f"[FAIL] Gagal memuat model: {e}")
        return None

def test_inference(session, model_name: str):
    """Jalankan dummy inference dengan tensor 1x3x640x640"""
    print(f"\n--- Inference dummy ({model_name}) ---")
    try:
        input_name = session.get_inputs()[0].name
        # Dummy image tensor: 1 batch, 3 channel, 640x640
        dummy = np.random.rand(1, 3, 640, 640).astype(np.float32)
        
        t0 = time.time()
        outputs = session.run(None, {input_name: dummy})
        elapsed = time.time() - t0
        
        out = outputs[0]
        print(f"[OK] Inference sukses dalam {elapsed:.2f}s")
        print(f"     Output shape: {out.shape}")
        print(f"     Output dtype: {out.dtype}")
        
        # YOLOv8 output biasanya [1, 84, 8400] — 84 = 4 bbox + 80 class
        # Tapi model kita 4 class, jadi [1, 8, 8400] atau sejenisnya
        if len(out.shape) == 3:
            num_preds = out.shape[2]
            num_cols = out.shape[1]
            print(f"     Prediksi: {num_preds} anchor points, {num_cols} values per anchor")
            print(f"     Expected: num_cols = 4 bbox + 4 classes = 8 → {'OK' if num_cols == 8 else f'UNEXPECTED ({num_cols})'}")
        return True
    except Exception as e:
        print(f"[FAIL] Inference gagal: {e}")
        return False

def main():
    print("=" * 60)
    print("  Test ONNX Standalone (simulasi Lambda environment)")
    print("=" * 60)
    
    ort = test_onnxruntime_import()
    
    models_to_test = [
        SCRIPT_DIR / "best.onnx",
        SCRIPT_DIR / "best_stable.onnx",
    ]
    
    results = {}
    for model_path in models_to_test:
        if not model_path.exists():
            print(f"\n[SKIP] {model_path.name} tidak ditemukan di {SCRIPT_DIR}")
            results[model_path.name] = "missing"
            continue
        
        session = test_load_model(ort, model_path)
        if session is None:
            results[model_path.name] = "load_failed"
            continue
        
        ok = test_inference(session, model_path.stem)
        results[model_path.name] = "ok" if ok else "inference_failed"
    
    print("\n" + "=" * 60)
    print("  HASIL AKHIR")
    print("=" * 60)
    all_ok = True
    for name, status in results.items():
        icon = "[OK]" if status == "ok" else ("[SKIP]" if status == "missing" else "[FAIL]")
        print(f"  {icon} {name}: {status}")
        if status != "ok":
            all_ok = False
    
    if all_ok:
        print("\n[OK] Semua model siap untuk Lambda deployment!")
    else:
        print("\n[FAIL] Ada model yang perlu diperbaiki sebelum deploy Lambda.")
    print("=" * 60)

if __name__ == "__main__":
    main()
