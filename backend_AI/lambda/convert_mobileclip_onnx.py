#!/usr/bin/env python3
"""
Convert MobileCLIP2-S0 vision encoder ke ONNX + precompute text embeddings.

Produces:
  models/mobileclip/vision_model.onnx  — image encoder (fp16, ~30 MB)
  models/mobileclip/text_embeds.npy    — 8 prompt embeddings (~16 KB)

Usage:
  python backend_AI/lambda/convert_mobileclip_onnx.py

Requires: torch, open_clip, timm (install opsional, hanya untuk konversi)
"""
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

try:
    import open_clip
    from timm.utils import reparameterize_model
except ImportError:
    print("ERROR: open_clip + timm diperlukan untuk konversi.")
    print("  pip install open-clip-torch timm")
    sys.exit(1)

MODEL_NAME = "MobileCLIP2-S0"
PRETRAINED = "dfndr2b"
OUTPUT_DIR = Path(__file__).parent / "models" / "mobileclip"
FP16 = False  # fp32 lebih stabil — ukuran masih acceptable untuk Lambda

PROMPTS = [
    "a damaged road with potholes and cracks, road infrastructure damage",
    "a road surface deterioration, crack, or pothole on asphalt",
    "a normal road without damage, smooth road surface",
    "a selfie photo of a person, portrait",
    "a plate of food, meal, or dish",
    "a document, screenshot, or phone screen capture",
    "a landscape, nature, sky, or mountain scenery",
    "a close up photo of an object indoors, electronics, or furniture",
]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    start = time.time()

    # ── Load model ──────────────────────────────────────────────────────────
    print(f"Loading {MODEL_NAME} ({PRETRAINED})...")
    model, _, _ = open_clip.create_model_and_transforms(MODEL_NAME, pretrained=PRETRAINED)
    model.eval()
    model = reparameterize_model(model)

    if FP16:
        model = model.half()
    print(f"  Model loaded in {time.time()-start:.1f}s")

    tokenizer = open_clip.get_tokenizer(MODEL_NAME)

    # ── Export vision encoder ───────────────────────────────────────────────
    vision_path = OUTPUT_DIR / "vision_model.onnx"
    print(f"Exporting vision encoder to {vision_path}...")

    dummy = torch.randn(1, 3, 224, 224)
    if FP16:
        dummy = dummy.half()

    class VisionEncoder(nn.Module):
        def __init__(self, enc):
            super().__init__()
            self.enc = enc
        def forward(self, x):
            return self.enc(x)

    vision_model = VisionEncoder(model.encode_image)
    vision_model.eval()

    torch.onnx.export(
        vision_model,
        dummy,
        vision_path,
        input_names=["pixel_values"],
        output_names=["image_embeds"],
        dynamic_axes={
            "pixel_values": {0: "batch"},
            "image_embeds": {0: "batch"},
        },
        opset_version=17,
        do_constant_folding=True,
    )

    # Merge external data → single file ONNX (portable untuk Docker/Lambda)
    data_path = vision_path.with_suffix(".onnx.data")
    if data_path.exists():
        import onnx
        model_proto = onnx.load(str(vision_path), load_external_data=False)
        onnx.load_external_data_for_model(model_proto, str(data_path.parent))
        onnx.save_model(model_proto, str(vision_path))
        data_path.unlink()
        print(f"  Merged external data into single file")

    size_mb = vision_path.stat().st_size / (1024 * 1024)
    print(f"  ✅ vision_model.onnx — {size_mb:.1f} MB (single file)")

    # ── Precompute text embeddings ──────────────────────────────────────────
    embeds_path = OUTPUT_DIR / "text_embeds.npy"
    print(f"Generating text embeddings to {embeds_path}...")

    text_tokens = tokenizer(PROMPTS)
    with torch.no_grad():
        text_features = model.encode_text(text_tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    np.save(embeds_path, text_features.cpu().float().numpy())
    size_kb = embeds_path.stat().st_size / 1024
    print(f"  ✅ text_embeds.npy — {size_kb:.1f} KB ({len(PROMPTS)} prompts)")

    # ── Sanity check: embedding shape ──────────────────────────────────────
    embeds = np.load(embeds_path)
    print(f"  text_embeds shape: {embeds.shape}  (expected: ({len(PROMPTS)}, 512))")

    # ── Verify ONNX can load ────────────────────────────────────────────────
    try:
        import onnx
        onnx_model = onnx.load(str(vision_path))
        onnx.checker.check_model(onnx_model)
        print("  ✅ ONNX model valid — checker passed")
    except ImportError:
        print("  ⚠️  onnx package not installed — skipping model validation")
    except Exception as e:
        print(f"  ❌ ONNX model invalid: {e}")
        sys.exit(1)

    elapsed = time.time() - start
    print(f"\n✅ Conversion complete in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
