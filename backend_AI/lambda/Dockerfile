# AWS Lambda Python 3.12 base image — 2026
FROM public.ecr.aws/lambda/python:3.12

# Copy model ONNX ke /opt/ (bukan /tmp/, biar tahan antar invoke)
# Model di /opt/ sudah tersedia tanpa download ulang di setiap cold start
# Copy semua model ONNX + MobileCLIP ke /opt/models/
# YOLO: best.onnx, best_stable.onnx
# MobileCLIP: vision_model.onnx, text_embeds.npy
COPY models/ /opt/models/

# Copy handler dan requirements
COPY handler.py requirements.txt ./

# Install dependensi — minimal, tanpa torch/ultralytics (~150 MB total)
RUN pip install -r requirements.txt --no-cache-dir

# Entry point Lambda
CMD ["handler.lambda_handler"]
