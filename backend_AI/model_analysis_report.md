================================================================================
                       ANALISIS KOMPARASI MODEL JALANKITA                       
                         Generated: 2026-06-17 15:16:13                         
================================================================================

================================================================================
  📦 best.pt — Model utama 196 epoch
================================================================================

🔹 INFORMASI UMUM
  Keys                : ['date', 'version', 'license', 'docs', 'epoch', 'best_fitness', 'model', 'ema', 'updates', 'optimizer', 'scaler', 'train_args', 'train_metrics', 'train_results', 'git']
  Epoch               : -1
  Best Fitness        : None
  Classes             : {0: 'lubang_besar', 1: 'lubang_kecil', 2: 'retak_kulit_buaya', 3: 'retak_memanjang'}
  Model Type          : [[-1, 1, 'Conv', [64, 3, 2]], [-1, 1, 'Conv', [128, 3, 2]], [-1, 3, 'C2f', [128, True]], [-1, 1, 'Conv', [256, 3, 2]], [-1, 6, 'C2f', [256, True]], [-1, 1, 'Conv', [512, 3, 2]], [-1, 6, 'C2f', [512, True]], [-1, 1, 'Conv', [1024, 3, 2]], [-1, 3, 'C2f', [1024, True]], [-1, 1, 'SPPF', [1024, 5]]]
  NC (num classes)    : 4

🔹 TRAINING PARAMETERS
  epochs              : 70
  imgsz               : 640
  batch               : 16
  lr0                 : 0.0005
  lrf                 : 0.01
  momentum            : 0.937
  optimizer           : AdamW
  weight_decay        : 0.0005
  warmup_epochs       : 3.0
  warmup_momentum     : 0.8
  box                 : 7.5
  cls                 : 0.5
  dfl                 : 1.5
  iou                 : 0.7
  degrees             : 30
  translate           : 0.1
  scale               : 0.5
  shear               : 0.0
  perspective         : 0.0
  flipud              : 0.5
  fliplr              : 0.5
  mosaic              : 1.0
  mixup               : 0.0
  copy_paste          : 0.1
  hsv_h               : 0.015
  hsv_s               : 0.7
  hsv_v               : 0.4
  augment             : True
  cache               : False
  device              : 0
  workers             : 8
  patience            : 20
  save                : True
  save_period         : 10
  amp                 : True

🔹 PERFORMANCE METRICS
  EMA                 : Available
  Updates             : None
  Training Date       : 2026-06-08T11:56:12.314658


================================================================================
                               📊 TABEL KOMPARASI                                
================================================================================
Model                          Epoch      Fitness         Img Size   Batch     
--------------------------------------------------------------------------------
best.pt                        -1         None            640        16        

================================================================================
                              ✅ Analisis selesai!                               
================================================================================