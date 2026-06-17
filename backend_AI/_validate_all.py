from ultralytics import YOLO
import os

data_yaml = r'C:\jalankita dataset\dataset_balanced_clean\data.yaml'
models = {
    'best_stable.pt': 'best_stable (70 epoch, no flipud, no copy_paste)',
    'best_corrupt.pt': 'best_corrupt',
    'best_best.pt': 'best_best',
}

for fname, label in models.items():
    if not os.path.exists(fname):
        print(f'\n{fname}: FILE TIDAK DITEMUKAN, skip')
        continue
    print(f'\n{"="*60}')
    print(f'VALIDASI: {label} ({fname})')
    print('='*60)
    model = YOLO(fname)
    results = model.val(data=data_yaml, split='test', imgsz=640, batch=8, conf=0.25, iou=0.5, device='cpu', verbose=False)
    print(f'  mAP50-95:   {results.box.map:.4f}')
    print(f'  mAP50:      {results.box.map50:.4f}')
    print(f'  mAP75:      {results.box.map75:.4f}')
    print(f'  Precision:  {results.box.mp:.4f}')
    print(f'  Recall:     {results.box.mr:.4f}')
    for i, name in enumerate(model.names.values()):
        ap50 = results.box.ap50[i]
        ap5095 = results.box.ap[i].mean()
        print(f'  [{i}] {name}: P={results.box.p[i]:.4f} R={results.box.r[i]:.4f} mAP50={ap50:.4f} mAP50-95={ap5095:.4f}')
