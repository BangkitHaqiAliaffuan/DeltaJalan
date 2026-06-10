# cek_model.py - Analisis Komparasi Model YOLOv8 JalanKita
import torch
from pathlib import Path

# Daftar semua model .pt yang ada
files = {
    "best.pt": "Model utama 130 epoch",
    "best_stable.pt": "Model stable backup",
    "best-stable (2).pt": "Model stable backup 2",
    "best-corrupt.pt": "Model corrupt",
    "last-best.pt": "Last checkpoint",
}

# Filter hanya yang ada
files = {k: v for k, v in files.items() if Path(k).exists()}

print("=" * 80)
print("ANALISIS KOMPARASI MODEL JALANKITA".center(80))
print("=" * 80)

results = []

for path, desc in files.items():
    print(f"\n{'='*80}")
    print(f"  📦 {path} — {desc}")
    print(f"{'='*80}")
    
    try:
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        
        # Data utama
        epoch = ckpt.get('epoch', '?')
        fitness = ckpt.get('best_fitness', '?')
        
        print(f"\n🔹 INFORMASI UMUM")
        print(f"  {'Keys':<20}: {list(ckpt.keys())}")
        print(f"  {'Epoch':<20}: {epoch}")
        print(f"  {'Best Fitness':<20}: {fitness}")
        
        # Model info
        model = ckpt.get("model")
        if model:
            if hasattr(model, "names"):
                print(f"  {'Classes':<20}: {model.names}")
            if hasattr(model, "yaml"):
                yaml_info = model.yaml
                if isinstance(yaml_info, dict):
                    print(f"  {'Model Type':<20}: {yaml_info.get('backbone', 'N/A')}")
                    print(f"  {'NC (num classes)':<20}: {yaml_info.get('nc', 'N/A')}")
        
        # Training arguments
        print(f"\n🔹 TRAINING PARAMETERS")
        args = ckpt.get("train_args", {})
        
        important_params = [
            "epochs", "imgsz", "batch", "lr0", "lrf", "momentum",
            "optimizer", "weight_decay", "warmup_epochs", "warmup_momentum",
            "box", "cls", "dfl", "conf", "iou",
            "degrees", "translate", "scale", "shear", "perspective",
            "flipud", "fliplr", "mosaic", "mixup", "copy_paste",
            "hsv_h", "hsv_s", "hsv_v",
            "augment", "cache", "device", "workers",
            "patience", "save", "save_period", "amp"
        ]
        
        for k in important_params:
            val = getattr(args, k, None) if hasattr(args, '__dict__') else args.get(k) if isinstance(args, dict) else None
            if val is not None:
                print(f"  {k:<20}: {val}")
        
        # Metrics/Results
        print(f"\n🔹 PERFORMANCE METRICS")
        if "metrics" in ckpt:
            metrics = ckpt["metrics"]
            print(f"  {'Metrics':<20}: {metrics}")
        
        # Results (mAP, precision, recall, dll)
        if "results" in ckpt:
            res = ckpt["results"]
            if res is not None and len(res) > 0:
                # Biasanya: [epoch, train_loss, val_loss, mAP50, mAP50-95, precision, recall, ...]
                print(f"  {'Results (raw)':<20}: {res}")
        
        # EMA (Exponential Moving Average)
        if "ema" in ckpt:
            print(f"  {'EMA':<20}: Available")
        
        # Optimizer state
        if "optimizer" in ckpt:
            opt = ckpt["optimizer"]
            if opt is not None:
                print(f"  {'Optimizer State':<20}: Available ({type(opt).__name__})")
        
        # Updates count
        if "updates" in ckpt:
            print(f"  {'Updates':<20}: {ckpt['updates']}")
        
        # Date
        if "date" in ckpt:
            print(f"  {'Training Date':<20}: {ckpt['date']}")
        
        # Simpan untuk komparasi
        results.append({
            'path': path,
            'desc': desc,
            'epoch': epoch,
            'fitness': fitness,
            'args': args
        })
        
    except Exception as e:
        print(f"\n❌ Error loading {path}: {e}")
        import traceback
        traceback.print_exc()

# Tabel komparasi
print(f"\n\n{'='*80}")
print("📊 TABEL KOMPARASI".center(80))
print("="*80)

if results:
    print(f"{'Model':<30} {'Epoch':<10} {'Fitness':<15} {'Img Size':<10} {'Batch':<10}")
    print("-" * 80)
    
    for r in results:
        args = r['args']
        imgsz = getattr(args, 'imgsz', None) if hasattr(args, '__dict__') else args.get('imgsz') if isinstance(args, dict) else '?'
        batch = getattr(args, 'batch', None) if hasattr(args, '__dict__') else args.get('batch') if isinstance(args, dict) else '?'
        
        print(f"{r['path']:<30} {str(r['epoch']):<10} {str(r['fitness']):<15} {str(imgsz):<10} {str(batch):<10}")

print("\n" + "="*80)
print("✅ Analisis selesai!".center(80))
print("="*80)