from ultralytics import YOLO
import os
import argparse
import numpy as np
import glob
import cv2

MODEL_PATHS = {
    "best_thebest": "best-thebest.pt",
    "best_corrupt": "best_corrupt.pt",
    "best_stable": "best_stable.pt",
    "best": "best.pt",
}
TEST_FOLDER = r"C:\jalankita dataset\foto_test"

CLASS_LABELS = {0: "lubang_besar", 1: "lubang_kecil", 2: "retak_kulit_buaya", 3: "retak_memanjang"}

# Mapping class index dari model lama (best_stable, best_thebest, best_corrupt) ke best.pt
OLD_TO_BEST = {0: 0, 1: 0, 2: 1, 3: 2}


def remap_boxes(boxes, mapping):
    return [[x1, y1, x2, y2, conf, mapping.get(cls, cls)] for x1, y1, x2, y2, conf, cls in boxes]


def calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def weighted_boxes_fusion(boxes_per_model, weights_per_model, iou_thr=0.5):
    all_boxes = []
    for model_boxes, weight in zip(boxes_per_model, weights_per_model):
        for x1, y1, x2, y2, conf, cls in model_boxes:
            all_boxes.append([x1, y1, x2, y2, conf, cls, weight])

    if not all_boxes:
        return []

    all_boxes.sort(key=lambda x: x[4], reverse=True)

    clusters = []
    for box in all_boxes:
        x1, y1, x2, y2, conf, cls, weight = box
        best_iou = iou_thr
        best_idx = -1
        for i, cluster in enumerate(clusters):
            if cluster["cls"] != cls:
                continue
            iou = calculate_iou([x1, y1, x2, y2], cluster["box"])
            if iou > best_iou:
                best_iou = iou
                best_idx = i

        if best_idx >= 0:
            clusters[best_idx]["boxes"].append(box)
        else:
            clusters.append({"boxes": [box], "box": [x1, y1, x2, y2], "cls": cls})

    n_models = len(boxes_per_model)
    result = []
    for cluster in clusters:
        boxes = cluster["boxes"]
        n = len(boxes)
        total_weight = sum(b[4] * b[6] for b in boxes)
        if total_weight <= 0:
            continue
        x1 = int(sum(b[0] * b[4] * b[6] for b in boxes) / total_weight)
        y1 = int(sum(b[1] * b[4] * b[6] for b in boxes) / total_weight)
        x2 = int(sum(b[2] * b[4] * b[6] for b in boxes) / total_weight)
        y2 = int(sum(b[3] * b[4] * b[6] for b in boxes) / total_weight)
        avg_conf = sum(b[4] for b in boxes) / n
        coverage = min(1.0, n / n_models)
        final_conf = avg_conf * coverage
        cls_votes = {}
        for b in boxes:
            cls_votes[b[5]] = cls_votes.get(b[5], 0) + b[4]
        final_cls = max(cls_votes, key=cls_votes.get)
        result.append([x1, y1, x2, y2, final_conf, final_cls])

    result.sort(key=lambda x: x[4], reverse=True)
    return result


def draw_boxes(img, boxes, class_names):
    colors = {
        0: (0, 80, 200),
        1: (200, 160, 0),
        2: (0, 120, 200),
        3: (200, 80, 0),
    }
    for x1, y1, x2, y2, conf, cls in boxes:
        color = colors.get(int(cls), (255, 0, 255))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
        label = f"{class_names[int(cls)]} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(img, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return img


def extract_boxes(result):
    if result.boxes is None or len(result.boxes) == 0:
        return []
    xyxy = result.boxes.xyxy.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    clss = result.boxes.cls.cpu().numpy()
    return [
        [int(xyxy[i][0]), int(xyxy[i][1]), int(xyxy[i][2]), int(xyxy[i][3]),
         float(confs[i]), int(clss[i])]
        for i in range(len(xyxy))
    ]


def main():
    global CLASS_LABELS
    parser = argparse.ArgumentParser(description="Bandingkan atau ensemble model YOLO")
    parser.add_argument("--ensemble", action="store_true",
                        help="Mode WBF ensemble")
    parser.add_argument("--compare-ensembles", action="store_true",
                        help="Compare 3 ensemble combinations: (best+best_stable), (best+best_thebest), (best_thebest+best_stable)")
    parser.add_argument("--single", type=str, default=None,
                        help="Jalankan single model saja (nama model dari MODEL_PATHS)")
    parser.add_argument("--models", nargs="+", default=None,
                        help="Model untuk ensemble (default: best_stable best_corrupt)")
    parser.add_argument("--weights", nargs="+", type=float, default=None,
                        help="Bobot per model (default: proporsional mAP50)")
    parser.add_argument("--conf", type=float, default=0.2,
                        help="Confidence threshold (default: 0.2)")
    parser.add_argument("--iou", type=float, default=0.5,
                        help="IoU threshold untuk NMS/WBF (default: 0.5)")
    parser.add_argument("--source", type=str, default=TEST_FOLDER,
                        help="Folder foto test (default: foto_test)")
    args = parser.parse_args()

    if not os.path.isdir(args.source):
        print(f"\n  Folder tidak ditemukan: {args.source}")
        print(f"  Ubah dengan: --source \"path/ke/folder\"\n")
        return

    # Mode compare ensembles
    if args.compare_ensembles:
        ensemble_configs = [
            ("best", "best_stable"),
            ("best", "best_thebest"),
            ("best_thebest", "best_stable"),
        ]
        
        print("\nLoading models...")
        all_models_needed = set()
        for config in ensemble_configs:
            all_models_needed.update(config)
        
        models = {}
        for name in all_models_needed:
            if name not in MODEL_PATHS:
                print(f"  Model tidak dikenal: {name}")
                return
            print(f"  Loading {name} ({MODEL_PATHS[name]})...")
            models[name] = YOLO(MODEL_PATHS[name])
        
        print(f"\n{'='*70}")
        print(f"  COMPARE ENSEMBLES")
        print(f"{'='*70}")
        for i, (m1, m2) in enumerate(ensemble_configs, 1):
            print(f"  Ensemble {i}: {m1} + {m2}")
        print(f"  Conf threshold: {args.conf}")
        print(f"  IoU threshold:  {args.iou}")
        print(f"  Source:         {args.source}")
        print(f"{'='*70}\n")
        
        exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
        files = sorted(set(
            f for ext in exts
            for pattern in (ext, ext.upper())
            for f in glob.glob(os.path.join(args.source, pattern))
        ))
        
        if not files:
            print("  Tidak ada file gambar di folder test")
            return
        
        # Prepare output directories
        ensemble_names = []
        out_dirs = []
        for m1, m2 in ensemble_configs:
            name = f"{m1}+{m2}"
            ensemble_names.append(name)
            out_dir = os.path.join("compare_output", f"ensemble_{name.replace('+', '_')}")
            os.makedirs(out_dir, exist_ok=True)
            out_dirs.append(out_dir)
        
        # Track totals
        totals = {name: 0 for name in ensemble_names}
        
        # Process each image
        for fpath in files:
            fname = os.path.basename(fpath)
            img = cv2.imread(fpath)
            if img is None:
                print(f"  {fname}: gagal dibaca, skip")
                continue
            
            print(f"  {fname}:")

            # Labels untuk setiap ensemble config
            best_labels = {int(k): str(v) for k, v in models["best"].names.items()} if "best" in models else CLASS_LABELS
            
            # Run each ensemble configuration
            for i, ((m1, m2), ename, out_dir) in enumerate(zip(ensemble_configs, ensemble_names, out_dirs)):
                # Get predictions from both models
                r1 = models[m1].predict(fpath, conf=args.conf, iou=args.iou, verbose=False)[0]
                r2 = models[m2].predict(fpath, conf=args.conf, iou=args.iou, verbose=False)[0]
                
                boxes1 = extract_boxes(r1)
                boxes2 = extract_boxes(r2)
                
                # Remap jika ensemble mencampur best.pt dengan model lama
                has_best = "best" in (m1, m2)
                if has_best:
                    if m1 != "best":
                        boxes1 = remap_boxes(boxes1, OLD_TO_BEST)
                    if m2 != "best":
                        boxes2 = remap_boxes(boxes2, OLD_TO_BEST)
                    display_labels = best_labels
                else:
                    display_labels = CLASS_LABELS
                
                # WBF fusion with equal weights
                weights = [0.5, 0.5]
                ensemble_boxes = weighted_boxes_fusion([boxes1, boxes2], weights, iou_thr=args.iou)
                
                totals[ename] += len(ensemble_boxes)
                
                # Draw and save
                out_img = img.copy()
                draw_boxes(out_img, ensemble_boxes, display_labels)
                cv2.imwrite(os.path.join(out_dir, fname), out_img)
                
                # Print results
                det_str = ", ".join(f"{display_labels[b[5]]} {b[4]:.0%}" for b in ensemble_boxes) or "\u2014"
                print(f"    Ensemble {i+1} ({ename:30s}): {len(ensemble_boxes)} deteksi - {det_str}")
            
            print()
        
        # Print summary
        print(f"{'='*70}")
        print(f"  SUMMARY - Total deteksi dari {len(files)} foto:")
        print(f"{'='*70}")
        for i, (ename, out_dir) in enumerate(zip(ensemble_names, out_dirs), 1):
            print(f"  Ensemble {i} ({ename:30s}): {totals[ename]:3d} deteksi")
            print(f"    \u2192 Output: {out_dir}/")
        print(f"{'='*70}\n")
        
        # Determine best ensemble
        best_ensemble = max(totals, key=totals.get)
        print(f"  \U0001F3C6 Ensemble dengan deteksi terbanyak: {best_ensemble} ({totals[best_ensemble]} deteksi)\n")
        return

    # Mode single model
    if args.single:
        if args.single not in MODEL_PATHS:
            print(f"\n  Model tidak dikenal: {args.single}")
            print(f"  Pilihan: {', '.join(MODEL_PATHS.keys())}\n")
            return
        
        model_path = MODEL_PATHS[args.single]
        print(f"\nLoading model: {args.single} ({model_path})...")
        model = YOLO(model_path)
        CLASS_LABELS = {int(k): str(v) for k, v in model.names.items()}
        
        print(f"\n{'='*55}")
        print(f"  SINGLE MODEL: {args.single}")
        print(f"{'='*55}")
        print(f"  Model path:     {model_path}")
        print(f"  Conf threshold: {args.conf}")
        print(f"  IoU threshold:  {args.iou}")
        print(f"  Source:         {args.source}")
        print(f"{'='*55}\n")
        
        exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
        files = sorted(set(
            f for ext in exts
            for pattern in (ext, ext.upper())
            for f in glob.glob(os.path.join(args.source, pattern))
        ))
        
        if not files:
            print("  Tidak ada file gambar di folder test")
            return
        
        out_dir = os.path.join("compare_output", f"single_{args.single}")
        os.makedirs(out_dir, exist_ok=True)
        
        total_detections = 0
        
        for fpath in files:
            fname = os.path.basename(fpath)
            img = cv2.imread(fpath)
            if img is None:
                print(f"  {fname}: gagal dibaca, skip")
                continue
            
            # Run inference
            result = model.predict(fpath, conf=args.conf, iou=args.iou, verbose=False)[0]
            boxes = extract_boxes(result)
            total_detections += len(boxes)
            
            # Draw boxes
            out_img = img.copy()
            draw_boxes(out_img, boxes, CLASS_LABELS)
            cv2.imwrite(os.path.join(out_dir, fname), out_img)
            
            # Print results
            det_str = ", ".join(f"{CLASS_LABELS[b[5]]} {b[4]:.0%}" for b in boxes) or "\u2014"
            print(f"  {fname}: {len(boxes)} deteksi - {det_str}")
        
        print(f"\n{'='*55}")
        print(f"  TOTAL: {total_detections} deteksi dari {len(files)} foto")
        print(f"{'='*55}")
        print(f"\n  Hasil gambar tersimpan di {out_dir}/\n")
        return

    if args.ensemble:
        model_names = args.models or ["best_stable", "best_corrupt"]
        model_paths = []
        for name in model_names:
            if name not in MODEL_PATHS:
                print(f"  Model tidak dikenal: {name}")
                print(f"  Pilihan: {', '.join(MODEL_PATHS.keys())}")
                return
            model_paths.append(MODEL_PATHS[name])

        if len(model_paths) < 2:
            print("  Minimal 2 model untuk ensemble")
            return

        n_models = len(model_paths)
        print("Loading models...")
        models = {name: YOLO(path) for name, path in zip(model_names, model_paths)}

        if args.weights and len(args.weights) == n_models:
            total_w = sum(args.weights)
            weights = [w / total_w for w in args.weights]
        else:
            weights = [1.0 / n_models] * n_models

        print(f"\n{'='*55}")
        print(f"  ENSEMBLE WBF: {' + '.join(model_names)}")
        print(f"{'='*55}")
        for name, w in zip(model_names, weights):
            print(f"  {name:20s} bobot={w:.2f}")
        print(f"  Conf threshold: {args.conf}")
        print(f"  IoU threshold:  {args.iou}")
        print(f"  Source:         {args.source}")
        print(f"{'='*55}\n")

        exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
        files = sorted(set(
            f for ext in exts
            for pattern in (ext, ext.upper())
            for f in glob.glob(os.path.join(args.source, pattern))
        ))

        if not files:
            print("  Tidak ada file gambar di folder test")
            return

        label = "_".join(model_names)
        out_dir = os.path.join("compare_output", f"ensemble_{label}")
        os.makedirs(out_dir, exist_ok=True)

        totals = {name: 0 for name in model_names}
        totals["ensemble"] = 0

        for fpath in files:
            fname = os.path.basename(fpath)
            img = cv2.imread(fpath)
            if img is None:
                print(f"  {fname}: gagal dibaca, skip")
                continue

            all_boxes = []
            for name, model in models.items():
                r = model.predict(fpath, conf=args.conf, iou=args.iou, verbose=False)[0]
                boxes = extract_boxes(r)
                all_boxes.append(boxes)
                totals[name] += len(boxes)

            ensemble_boxes = weighted_boxes_fusion(all_boxes, weights, iou_thr=args.iou)

            out_img = img.copy()
            draw_boxes(out_img, ensemble_boxes, CLASS_LABELS)
            cv2.imwrite(os.path.join(out_dir, fname), out_img)

            n_e = len(ensemble_boxes)
            totals["ensemble"] += n_e

            print(f"  {fname}:")
            for name, boxes in zip(model_names, all_boxes):
                det = ", ".join(f"{CLASS_LABELS[b[5]]} {b[4]:.0%}" for b in boxes) or "\u2014"
                print(f"    {name:20s}: {len(boxes)} deteksi - {det}")
            det_e = ", ".join(f"{CLASS_LABELS[b[5]]} {b[4]:.0%}" for b in ensemble_boxes) or "\u2014"
            print(f"    {'ensemble':20s}: {n_e} deteksi - {det_e}")

            per_model_counts = [len(b) for b in all_boxes]
            if n_e > max(per_model_counts):
                print(f"    \u2191 ensemble menggabungkan deteksi dari semua model")
            elif n_e < min(per_model_counts):
                print(f"    \u2193 ensemble menyaring false positive")
            elif len(set(per_model_counts)) == 1 and n_e == per_model_counts[0] and n_e > 0:
                print(f"    \u2192 deteksi identik di semua model")
            print()

        print(f"{'='*55}")
        print(f"  TOTAL:")
        for name in model_names:
            print(f"    {name:20s}: {totals[name]} deteksi dari {len(files)} foto")
        print(f"    {'ensemble':20s}: {totals['ensemble']} deteksi dari {len(files)} foto")
        print(f"{'='*55}")
        print(f"\n  Hasil gambar tersimpan di {out_dir}/")

    else:
        compare_names = ["best_thebest", "best_corrupt", "best_stable"]
        models = {name: YOLO(MODEL_PATHS[name]) for name in compare_names}

        for name, model in models.items():
            print(f"\n{'='*40}")
            print(f"  {name}")
            print(f"{'='*40}")
            results = model.predict(
                source=args.source,
                conf=args.conf,
                iou=0.5,
                save=True,
                project="compare_output",
                name=name,
                verbose=False,
            )
            total = sum(len(r.boxes) for r in results)
            print(f"  Total deteksi: {total} dari {len(results)} foto")
            for r in results:
                fname = os.path.basename(r.path)
                dets = [f"{model.names[int(b.cls[0])]} {float(b.conf[0]):.0%}" for b in r.boxes]
                print(f"  {fname}: {dets if dets else 'tidak ada deteksi'}")

        print("\n  Hasil gambar tersimpan di folder compare_output/")


if __name__ == "__main__":
    main()
