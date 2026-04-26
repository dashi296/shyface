"""
LFW (Labeled Faces in the Wild) のペア画像から FaceNet embedding を生成し、
__fixtures__/face_embeddings.json に保存するスクリプト。

実行方法: scripts/README.md を参照
"""

import argparse
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

warnings.filterwarnings("ignore")

REPO_ROOT = Path(__file__).parent.parent
FIXTURE_PATH = REPO_ROOT / "__fixtures__" / "face_embeddings.json"
MODEL_PATH = REPO_ROOT / "assets" / "models" / "facenet.tflite"
MODEL_INPUT_SIZE = 160


def load_interpreter():
    try:
        try:
            import tflite_runtime.interpreter as tflite
            interpreter = tflite.Interpreter(model_path=str(MODEL_PATH))
        except ImportError:
            import tensorflow as tf
            interpreter = tf.lite.Interpreter(model_path=str(MODEL_PATH))
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        sys.exit(1)

    interpreter.allocate_tensors()
    input_idx = interpreter.get_input_details()[0]["index"]
    output_idx = interpreter.get_output_details()[0]["index"]
    return interpreter, input_idx, output_idx


def preprocess(image_path: Path) -> np.ndarray:
    """FaceNet.ts の uriToFloat32Input と同一の前処理を行う。

    NOTE: Skia と Pillow のリサイズ結果は完全一致しないが、embedding への影響は軽微。
    BILINEAR は Skia の補間に最も近い。
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), Image.BILINEAR)
    pixels = np.array(img, dtype=np.float32)
    normalized = (pixels - 128.0) / 128.0
    return normalized[np.newaxis, ...]  # shape: (1, 160, 160, 3)


def extract_embedding(interpreter, input_idx: int, output_idx: int, image_path: Path) -> list[float]:
    input_tensor = preprocess(image_path)
    interpreter.set_tensor(input_idx, input_tensor)
    interpreter.invoke()
    return interpreter.get_tensor(output_idx)[0].tolist()


def parse_pairs(pairs_file: Path, lfw_root: Path, n_same: int, n_diff: int):
    """pairs.txt を読み込み、同一人物ペアと別人ペアを返す。

    pairs.txt フォーマット:
      1行目: <total_sets>\t<images_per_set>
      同一人物ペア: <name>\t<n1>\t<n2>
      別人ペア:     <name1>\t<n1>\t<name2>\t<n2>
    """
    same_pairs: list[tuple[Path, Path]] = []
    diff_pairs: list[tuple[Path, Path]] = []

    with open(pairs_file) as f:
        header = f.readline().strip().split()
        sets, per_set = int(header[0]), int(header[1])

        for _ in range(sets * per_set):
            line = f.readline().strip()
            if not line:
                continue
            parts = line.split("\t")

            if len(parts) == 3:
                name, n1, n2 = parts[0], int(parts[1]), int(parts[2])
                p1 = lfw_root / name / f"{name}_{n1:04d}.jpg"
                p2 = lfw_root / name / f"{name}_{n2:04d}.jpg"
                if p1.exists() and p2.exists():
                    same_pairs.append((p1, p2))
            elif len(parts) == 4:
                name1, n1, name2, n2 = parts[0], int(parts[1]), parts[2], int(parts[3])
                p1 = lfw_root / name1 / f"{name1}_{n1:04d}.jpg"
                p2 = lfw_root / name2 / f"{name2}_{n2:04d}.jpg"
                if p1.exists() and p2.exists():
                    diff_pairs.append((p1, p2))

    return same_pairs[:n_same], diff_pairs[:n_diff]


def main():
    parser = argparse.ArgumentParser(description="Generate FaceNet embedding fixtures from LFW")
    parser.add_argument("--lfw-root", required=True, help="Path to LFW root directory (containing lfw_funneled/ or lfw/)")
    parser.add_argument("--pairs", default=None, help="Path to pairs.txt (default: <lfw-root>/pairs.txt)")
    parser.add_argument("--n-same", type=int, default=150, help="Number of same-person pairs (default: 150)")
    parser.add_argument("--n-diff", type=int, default=150, help="Number of different-person pairs (default: 150)")
    args = parser.parse_args()

    lfw_root = Path(args.lfw_root)
    pairs_file = Path(args.pairs) if args.pairs else lfw_root / "pairs.txt"

    # lfw_funneled か lfw かを自動判定
    image_root = lfw_root / "lfw_funneled"
    if not image_root.exists():
        image_root = lfw_root / "lfw"
    if not image_root.exists():
        image_root = lfw_root

    if not pairs_file.exists():
        print(f"pairs.txt not found: {pairs_file}", file=sys.stderr)
        sys.exit(1)
    if not MODEL_PATH.exists():
        print(f"Model not found: {MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading model from {MODEL_PATH}...")
    interpreter, input_idx, output_idx = load_interpreter()

    print(f"Parsing pairs from {pairs_file}...")
    same_pairs, diff_pairs = parse_pairs(pairs_file, image_root, args.n_same, args.n_diff)
    print(f"  same pairs found: {len(same_pairs)}, diff pairs found: {len(diff_pairs)}")

    if len(same_pairs) < args.n_same or len(diff_pairs) < args.n_diff:
        print(
            f"Warning: fewer pairs than requested. "
            f"same={len(same_pairs)}/{args.n_same}, diff={len(diff_pairs)}/{args.n_diff}",
            file=sys.stderr,
        )

    def embed_pairs(pairs: list[tuple[Path, Path]], label: str):
        results = []
        for i, (p1, p2) in enumerate(pairs, 1):
            print(f"  [{label}] {i}/{len(pairs)}: {p1.name} & {p2.name}")
            results.append({
                "a": extract_embedding(interpreter, input_idx, output_idx, p1),
                "b": extract_embedding(interpreter, input_idx, output_idx, p2),
            })
        return results

    print("Extracting embeddings for same-person pairs...")
    same_embeddings = embed_pairs(same_pairs, "same")

    print("Extracting embeddings for different-person pairs...")
    diff_embeddings = embed_pairs(diff_pairs, "diff")

    fixture = {
        "_meta": {
            "scope": "FaceNet model accuracy only (face detection step excluded)",
            "dataset": "LFW",
            "model": "facenet.tflite",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": (
                "LFW images are pre-aligned. "
                "Full pipeline (detect→crop→embed) is not covered."
            ),
            "n_same_pairs": len(same_embeddings),
            "n_diff_pairs": len(diff_embeddings),
        },
        "same_pairs": same_embeddings,
        "diff_pairs": diff_embeddings,
    }

    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FIXTURE_PATH, "w") as f:
        json.dump(fixture, f, separators=(",", ":"))

    print(f"\nFixture saved to {FIXTURE_PATH}")
    size_kb = FIXTURE_PATH.stat().st_size / 1024
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
