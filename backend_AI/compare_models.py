from ultralytics import YOLO
import os

MODEL_A = "best_stable.pt"
MODEL_B = "best.pt"
TEST_FOLDER = r"C:\jalankita\foto_test"  # folder foto test kamu
CONF = 0.4

models = {"best_stable": YOLO(MODEL_A), "best_130epoch": YOLO(MODEL_B)}

for name, model in models.items():
    print(f"\n{'='*40}")
    print(f"  {name}")
    print(f"{'='*40}")
    results = model.predict(
        source=TEST_FOLDER,
        conf=CONF,
        iou=0.5,
        save=True,
        project="compare_output",
        name=name,
        verbose=False
    )
    total = sum(len(r.boxes) for r in results)
    print(f"  Total deteksi: {total} dari {len(results)} foto")
    for r in results:
        fname = os.path.basename(r.path)
        dets = [f"{model.names[int(b.cls[0])]} {float(b.conf[0]):.0%}" for b in r.boxes]
        print(f"  {fname}: {dets if dets else 'tidak ada deteksi'}")

print("\n✅ Hasil gambar tersimpan di folder compare_output/")