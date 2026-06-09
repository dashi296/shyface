"""
FaceNet TFLite モデルでフィクスチャ画像の embedding を生成し JSON に保存する。

出力: e2e/fixtures/embeddings.json

前提:
  - e2e/fixtures/faces/ が生成済み（scripts/download-test-fixtures.sh 実行済み）
  - assets/models/facenet.tflite が存在する

必要な Python パッケージ:
  pip install tflite-runtime numpy pillow
  ※ tflite-runtime が入らない環境では tensorflow でも可
    pip install tensorflow numpy pillow
"""

import json
import sys
import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image

MODEL_INPUT_SIZE = 160

PROJECT_DIR = Path(__file__).parent.parent
FIXTURES_DIR = PROJECT_DIR / "e2e" / "fixtures" / "faces"
MODEL_PATH   = PROJECT_DIR / "assets" / "models" / "facenet.tflite"
OUTPUT_PATH  = PROJECT_DIR / "e2e" / "fixtures" / "embeddings.json"

IMAGE_KEYS: dict[str, str] = {
    "person_a/1_front":            "person_a/1_front.jpg",
    "person_a/2_left":             "person_a/2_left.jpg",
    "person_a/3_right":            "person_a/3_right.jpg",
    "person_b/1_front":            "person_b/1_front.jpg",
    "person_b/2_left":             "person_b/2_left.jpg",
    "person_b/3_right":            "person_b/3_right.jpg",
    "recognition/match_person_a":  "recognition/match_person_a.jpg",
    "recognition/match_person_b":  "recognition/match_person_b.jpg",
    "recognition/no_match":        "recognition/no_match.jpg",
}


def _load_interpreter():
    """tflite-runtime を優先し、なければ tensorflow の TFLite を使う。"""
    if importlib.util.find_spec("tflite_runtime"):
        import tflite_runtime.interpreter as tflite  # type: ignore
        return tflite.Interpreter(model_path=str(MODEL_PATH))
    try:
        import tensorflow as tf  # type: ignore
        return tf.lite.Interpreter(model_path=str(MODEL_PATH))
    except ImportError:
        print("ERROR: tflite-runtime または tensorflow が必要です。")
        print("  pip install tflite-runtime numpy pillow")
        sys.exit(1)


def preprocess(path: Path) -> np.ndarray:
    """JS 側の FaceNet.ts と同一の前処理を適用する。

    FaceNet.ts の前処理:
      - Skia で 160×160 にリサイズ
      - RGBA ピクセルを読み取り、R/G/B のみ使用
      - 正規化: (value - 128) / 128  → [-1, 1]
      - shape: [1, 160, 160, 3]  (NHWC)
    """
    img = Image.open(path).convert("RGB").resize(
        (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), Image.LANCZOS
    )
    arr = np.array(img, dtype=np.float32)
    arr = (arr - 128.0) / 128.0
    return arr[np.newaxis, ...]  # [1, 160, 160, 3]


def generate_embedding(interpreter, image_path: Path) -> list[float]:
    input_idx  = interpreter.get_input_details()[0]["index"]
    output_idx = interpreter.get_output_details()[0]["index"]

    interpreter.set_tensor(input_idx, preprocess(image_path))
    interpreter.invoke()
    output = interpreter.get_tensor(output_idx)
    return output[0].tolist()


def main() -> None:
    # 前提ファイルの確認
    if not MODEL_PATH.exists():
        print(f"ERROR: モデルが見つかりません: {MODEL_PATH}")
        sys.exit(1)
    if not FIXTURES_DIR.exists():
        print(f"ERROR: フィクスチャ画像がありません: {FIXTURES_DIR}")
        print("  先に bash scripts/download-test-fixtures.sh を実行してください。")
        sys.exit(1)

    print(f"モデル: {MODEL_PATH}")
    interpreter = _load_interpreter()
    interpreter.allocate_tensors()

    # 入力 shape の確認（デバッグ用）
    input_details = interpreter.get_input_details()[0]
    print(f"モデル入力 shape: {input_details['shape']}  dtype: {input_details['dtype'].__name__}")

    embeddings: dict[str, list[float]] = {}
    missing: list[str] = []

    for key, rel_path in IMAGE_KEYS.items():
        img_path = FIXTURES_DIR / rel_path
        if not img_path.exists():
            print(f"  SKIP (not found): {img_path}")
            missing.append(key)
            continue
        emb = generate_embedding(interpreter, img_path)
        embeddings[key] = emb
        print(f"  OK  {key}: {len(emb)}-dim")

    if missing:
        print(f"\n警告: {len(missing)} 件の画像が見つかりませんでした。")
        print("  bash scripts/download-test-fixtures.sh を実行してください。")

    OUTPUT_PATH.write_text(json.dumps(embeddings, indent=2))
    print(f"\n保存完了: {OUTPUT_PATH}  ({len(embeddings)} embeddings)")


if __name__ == "__main__":
    main()
