# cek_model.py - Analisis Komparasi Model YOLOv8 JalanKita
import torch
from pathlib import Path
from datetime import datetime

# Daftar semua model .pt yang ada
files = {
    "best.pt": "Model utama 196 epoch",
    "best_best.pt": "Model stable best",
    "best-stable.pt": "Model stable backup 2",
    "best-corrupt.pt": "Model corrupt",
    "last-best.pt": "Last checkpoint",
}

# Filter hanya yang ada
files = {k: v for k, v in files.items() if Path(k).exists()}

# Setup output file
output_file = "model_analysis_report.md"
output_lines = []

def log(text="", to_console=True, to_file=True):
    """Print to console and/or save to output list"""
    if to_console:
        print(text)
    if to_file:
        output_lines.append(text)

# Header
timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
log("=" * 80)
log("ANALISIS KOMPARASI MODEL JALANKITA".center(80))
log(f"Generated: {timestamp}".center(80))
log("=" * 80)

results = []

for path, desc in files.items():
    log(f"\n{'='*80}")
    log(f"  📦 {path} — {desc}")
    log(f"{'='*80}")
    
    try:
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        
        # Data utama
        epoch = ckpt.get('epoch', '?')
        fitness = ckpt.get('best_fitness', '?')
        
        log(f"\n🔹 INFORMASI UMUM")
        log(f"  {'Keys':<20}: {list(ckpt.keys())}")
        log(f"  {'Epoch':<20}: {epoch}")
        log(f"  {'Best Fitness':<20}: {fitness}")
        
        # Model info
        model = ckpt.get("model")
        classes_info = None
        if model:
            if hasattr(model, "names"):
                classes_info = model.names
                log(f"  {'Classes':<20}: {classes_info}")
            if hasattr(model, "yaml"):
                yaml_info = model.yaml
                if isinstance(yaml_info, dict):
                    log(f"  {'Model Type':<20}: {yaml_info.get('backbone', 'N/A')}")
                    log(f"  {'NC (num classes)':<20}: {yaml_info.get('nc', 'N/A')}")
        
        # Training arguments
        log(f"\n🔹 TRAINING PARAMETERS")
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
                log(f"  {k:<20}: {val}")
        
        # Metrics/Results
        log(f"\n🔹 PERFORMANCE METRICS")
        if "metrics" in ckpt:
            metrics = ckpt["metrics"]
            log(f"  {'Metrics':<20}: {metrics}")
        
        # Results (mAP, precision, recall, dll)
        if "results" in ckpt:
            res = ckpt["results"]
            if res is not None and len(res) > 0:
                # Biasanya: [epoch, train_loss, val_loss, mAP50, mAP50-95, precision, recall, ...]
                log(f"  {'Results (raw)':<20}: {res}")
        
        # EMA (Exponential Moving Average)
        if "ema" in ckpt:
            log(f"  {'EMA':<20}: Available")
        
        # Optimizer state
        if "optimizer" in ckpt:
            opt = ckpt["optimizer"]
            if opt is not None:
                log(f"  {'Optimizer State':<20}: Available ({type(opt).__name__})")
        
        # Updates count
        if "updates" in ckpt:
            log(f"  {'Updates':<20}: {ckpt['updates']}")
        
        # Date
        if "date" in ckpt:
            log(f"  {'Training Date':<20}: {ckpt['date']}")
        
        # Simpan untuk komparasi
        results.append({
            'path': path,
            'desc': desc,
            'epoch': epoch,
            'fitness': fitness,
            'args': args,
            'classes': classes_info
        })
        
    except Exception as e:
        log(f"\n❌ Error loading {path}: {e}")
        import traceback
        error_trace = traceback.format_exc()
        log(error_trace)

# Tabel komparasi
log(f"\n\n{'='*80}")
log("📊 TABEL KOMPARASI".center(80))
log("="*80)

if results:
    log(f"{'Model':<30} {'Epoch':<10} {'Fitness':<15} {'Img Size':<10} {'Batch':<10}")
    log("-" * 80)
    
    for r in results:
        args = r['args']
        imgsz = getattr(args, 'imgsz', None) if hasattr(args, '__dict__') else args.get('imgsz') if isinstance(args, dict) else '?'
        batch = getattr(args, 'batch', None) if hasattr(args, '__dict__') else args.get('batch') if isinstance(args, dict) else '?'
        
        log(f"{r['path']:<30} {str(r['epoch']):<10} {str(r['fitness']):<15} {str(imgsz):<10} {str(batch):<10}")

log("\n" + "="*80)
log("✅ Analisis selesai!".center(80))
log("="*80)

# Save to markdown file
with open(output_file, "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

print(f"\n📄 Report tersimpan di: {output_file}")
print(f"📁 Path lengkap: {Path(output_file).absolute()}")