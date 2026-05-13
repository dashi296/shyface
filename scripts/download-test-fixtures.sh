#!/usr/bin/env bash
# テスト用顔写真フィクスチャを生成する。
#
# 処理の流れ:
#   1. thispersondoesnotexist.com から AI 生成顔を3枚ダウンロード（ベース画像）
#   2. Python + Pillow で明度/コントラスト/彩度バリエーションを生成
#      → 登録用 (person_a, person_b) と認識テスト用 (recognition/) の両方を出力
#   3. ベース一時ファイルを削除
#
# 出力先:
#   e2e/fixtures/faces/
#   ├── person_a/{1,2,3}.jpg         ← person_a の登録用（同一人物の3バリエーション）
#   ├── person_b/{1,2,3}.jpg         ← person_b の登録用（同一人物の3バリエーション）
#   └── recognition/
#       ├── match_person_a.jpg       ← person_a と一致するはず → ブラーされる
#       ├── match_person_b.jpg       ← person_b と一致するはず → ブラーされる
#       ├── no_match.jpg             ← どちらとも一致しない別人 → ブラーされない
#       └── group_ab.jpg             ← person_a + person_b の合成 → 両方ブラーされる
#
# 使い方:
#   bash scripts/download-test-fixtures.sh
#
# 必要なもの:
#   - Python 3 + Pillow（macOS に標準でインストール済みの場合が多い）
#   - インターネット接続

set -euo pipefail

FIXTURES_DIR="e2e/fixtures/faces"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR=$(mktemp -d)
URL="https://thispersondoesnotexist.com/"
SLEEP_SEC=2

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# 依存ライブラリの確認
if ! python3 -c "from PIL import Image" 2>/dev/null; then
  echo "ERROR: Pillow not found. Install with: pip3 install Pillow"
  exit 1
fi
if ! python3 -c "import numpy" 2>/dev/null; then
  echo "ERROR: numpy not found. Install with: pip3 install numpy"
  exit 1
fi

download_face() {
  local dest="$1"
  echo "  downloading → $dest"
  curl -s -L \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -H "Referer: https://thispersondoesnotexist.com/" \
    "$URL" -o "$dest"
  sleep "$SLEEP_SEC"
}

# すべての出力ファイルが揃っていればスキップ
all_files=(
  "$FIXTURES_DIR/person_a/1_front.jpg"
  "$FIXTURES_DIR/person_a/2_left.jpg"
  "$FIXTURES_DIR/person_a/3_right.jpg"
  "$FIXTURES_DIR/person_b/1_front.jpg"
  "$FIXTURES_DIR/person_b/2_left.jpg"
  "$FIXTURES_DIR/person_b/3_right.jpg"
  "$FIXTURES_DIR/recognition/match_person_a.jpg"
  "$FIXTURES_DIR/recognition/match_person_b.jpg"
  "$FIXTURES_DIR/recognition/no_match.jpg"
  "$FIXTURES_DIR/recognition/group_ab.jpg"
)
missing=0
for f in "${all_files[@]}"; do
  [[ -f "$f" ]] || missing=1
done
if [[ $missing -eq 0 ]]; then
  echo "All fixtures already exist. Skipping download."
  echo "To re-generate, delete e2e/fixtures/faces/ and re-run."
  exit 0
fi

echo "=== shyface test fixtures: download + generate ==="
echo ""

echo "[1/2] Downloading base images..."
download_face "$TMP_DIR/base_a.jpg"
download_face "$TMP_DIR/base_b.jpg"
download_face "$TMP_DIR/base_no_match.jpg"

echo ""
echo "[2/2] Generating registration & recognition variants..."
python3 "$SCRIPT_DIR/_generate_variations.py" \
  "$TMP_DIR/base_a.jpg" \
  "$TMP_DIR/base_b.jpg" \
  "$TMP_DIR/base_no_match.jpg" \
  "$FIXTURES_DIR"

echo ""
echo "Done. Run 'bash scripts/load-fixtures-to-simulator.sh' to inject into the iOS simulator."
