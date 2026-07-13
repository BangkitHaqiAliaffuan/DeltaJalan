# Model ONNX files di-copy ke sini saat eksekusi Phase 1
# (tidak dicommit ke git karena ukuran besar — ~14MB total)
#
# File yang dibutuhkan:
#   best.onnx        (~2.9 MB) — copy dari backend_AI/best.onnx
#   best_stable.onnx (~11 MB)  — copy dari backend_AI/best_stable.onnx
#
# Cara copy (dari root repo):
#   cp backend_AI/best.onnx backend_AI/lambda/models/
#   cp backend_AI/best_stable.onnx backend_AI/lambda/models/
