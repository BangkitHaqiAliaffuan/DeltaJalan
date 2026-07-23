# AWS Lambda Python 3.12 base image — 2026
FROM public.ecr.aws/lambda/python:3.12

# Copy model ONNX ke /opt/ (bukan /tmp/, biar tahan antar invoke)
# Model di /opt/ sudah tersedia tanpa download ulang di setiap cold start
# YOLO: best.onnx, best_stable.onnx (from git)
COPY models/best.onnx models/best_stable.onnx /opt/models/

# MobileCLIP: vision_model.onnx + text_embeds.npy (from S3 — tidak di git)
RUN mkdir -p /opt/models/mobileclip && \
    curl -sL -o /opt/models/mobileclip/vision_model.onnx \
      "https://jalankita-models.s3.ap-southeast-1.amazonaws.com/mobileclip/vision_model.onnx" && \
    curl -sL -o /opt/models/mobileclip/text_embeds.npy \
      "https://jalankita-models.s3.ap-southeast-1.amazonaws.com/mobileclip/text_embeds.npy"

# Copy handler dan requirements
COPY handler.py requirements.txt ./

# Install dependensi — minimal, tanpa torch/ultralytics (~150 MB total)
RUN pip install -r requirements.txt --no-cache-dir

# Entry point Lambda
CMD ["handler.lambda_handler"]
