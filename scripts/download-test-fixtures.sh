#!/usr/bin/env bash
# テスト用顔写真フィクスチャを生成する。
#
# 処理の流れ:
#   1. リポジトリの e2e/fixtures/seeds/ からベース画像をコピー（固定・再現性保証）
#   2. Docker コンテナ内で InsightFace + scipy TPS ワープを実行し
#      登録用 (person_a, person_b) と認識テスト用 (recognition/) の両方を出力
#   3. ベース一時ファイルを削除
#
# 出力先:
#   e2e/fixtures/faces/
#   ├── person_a/{1_front,2_left,3_right}.jpg   ← 登録用（3アングル）
#   ├── person_b/{1_front,2_left,3_right}.jpg
#   └── recognition/
#       ├── match_person_a.jpg
#       ├── match_person_b.jpg
#       ├── no_match.jpg
#       └── group_ab.jpg
#
# 使い方:
#   bash scripts/download-test-fixtures.sh           # 通常実行
#   bash scripts/download-test-fixtures.sh --rebuild # Docker イメージを強制再ビルド
#
# 必要なもの:
#   - Docker（Python / InsightFace 依存はコンテナ内で解決）
#   - 初回実行時のみインターネット接続（InsightFace モデル ~350MB のダウンロード）
#
# シード画像を差し替えるには:
#   e2e/fixtures/seeds/{base_a,base_b,base_no_match}.jpg を更新してコミットし、
#   再実行するだけでよい（シードのハッシュが変われば自動で再生成される）。

set -euo pipefail

FIXTURES_DIR="e2e/fixtures/faces"
SEEDS_DIR="e2e/fixtures/seeds"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR=$(mktemp -d)
# 生成中の出力先（FIXTURES_DIR と同一 FS 上に置くことで mv がアトミックになる）
TMP_OUTPUT="$(dirname "$PROJECT_DIR/$FIXTURES_DIR")/.faces-generating"
DOCKER_IMAGE="shyface-fixtures:latest"
INSIGHTFACE_CACHE="${HOME}/.cache/shyface-insightface"
# 生成アルゴリズムを変更した際はここをインクリメントする
GENERATOR_VERSION="2"
VERSION_FILE="$PROJECT_DIR/$FIXTURES_DIR/.generator-version"

cleanup() {
  rm -rf "$TMP_DIR"
  rm -rf "$TMP_OUTPUT"
}
trap cleanup EXIT

# --rebuild フラグは最初に解釈する（スキップ判定より前）
REBUILD=0
if [[ "${1:-}" == "--rebuild" ]]; then
  REBUILD=1
  echo "=== --rebuild: フィクスチャと Docker イメージを強制再生成します ==="
fi

# バージョンチェック + シードハッシュ + ファイル存在チェック → すべて満たせば Docker 不要でスキップ
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
# シードファイルと生成スクリプトのハッシュをキャッシュキーに含める（変更時に自動で再生成）
SEEDS_HASH=$(find "$PROJECT_DIR/$SEEDS_DIR" -type f | sort | xargs shasum -a 256 | shasum -a 256 | awk '{print $1}')
GENERATOR_SCRIPT_HASH=$(shasum -a 256 "$SCRIPT_DIR/_generate_variations.py" | awk '{print $1}')
DOCKERFILE_HASH=$(shasum -a 256 "$SCRIPT_DIR/Dockerfile.fixtures" | awk '{print $1}')
CACHE_KEY="${GENERATOR_VERSION}:${SEEDS_HASH}:${GENERATOR_SCRIPT_HASH}:${DOCKERFILE_HASH}"
stored_key=$(cat "$VERSION_FILE" 2>/dev/null || echo "")
if [[ $REBUILD -eq 0 && $missing -eq 0 && "$stored_key" == "$CACHE_KEY" ]]; then
  echo "All fixtures already exist (generator v${GENERATOR_VERSION}, seeds unchanged). Skipping generation."
  exit 0
fi
if [[ $missing -eq 0 && "$stored_key" != "$CACHE_KEY" ]]; then
  echo "Generator or seed images updated. Re-generating fixtures..."
fi

# Docker の確認
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker が見つかりません。Docker Desktop をインストールしてください。"
  echo "  https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info &>/dev/null 2>&1; then
  echo "ERROR: Docker デーモンが起動していません。Docker Desktop を起動してください。"
  exit 1
fi

# Docker イメージのビルド
# Dockerfile.fixtures のハッシュをイメージラベルに保存し、変更時は自動で再ビルドする
STORED_HASH=$(docker inspect --format '{{index .Config.Labels "dockerfile_hash"}}' "$DOCKER_IMAGE" 2>/dev/null || echo "")
if [[ $REBUILD -eq 1 ]] \
    || ! docker image inspect "$DOCKER_IMAGE" &>/dev/null 2>&1 \
    || [[ "$STORED_HASH" != "$DOCKERFILE_HASH" ]]; then
  echo "=== Docker イメージをビルドしています（初回またはDockerfile変更時）==="
  docker build -t "$DOCKER_IMAGE" \
    --label "dockerfile_hash=$DOCKERFILE_HASH" \
    -f "$SCRIPT_DIR/Dockerfile.fixtures" "$SCRIPT_DIR"
  echo ""
fi

echo "=== shyface test fixtures: generate ==="
echo ""

# シード画像の存在確認
for seed in "$PROJECT_DIR/$SEEDS_DIR/base_a.jpg" "$PROJECT_DIR/$SEEDS_DIR/base_b.jpg" "$PROJECT_DIR/$SEEDS_DIR/base_no_match.jpg"; do
  if [[ ! -f "$seed" ]]; then
    echo "ERROR: seed image not found: $seed"
    exit 1
  fi
done

echo "[1/2] Copying seed images..."
cp "$PROJECT_DIR/$SEEDS_DIR/base_a.jpg"        "$TMP_DIR/base_a.jpg"
cp "$PROJECT_DIR/$SEEDS_DIR/base_b.jpg"        "$TMP_DIR/base_b.jpg"
cp "$PROJECT_DIR/$SEEDS_DIR/base_no_match.jpg" "$TMP_DIR/base_no_match.jpg"

rm -rf "$TMP_OUTPUT"
mkdir -p "$TMP_OUTPUT"
mkdir -p "$INSIGHTFACE_CACHE"

echo ""
echo "[2/2] Generating registration & recognition variants (via Docker)..."
echo "  InsightFace モデルは初回実行時にダウンロードされます（~350MB）"
echo "  モデルキャッシュ先: $INSIGHTFACE_CACHE"
echo ""

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e INSIGHTFACE_HOME=/cache \
  -v "$SCRIPT_DIR/_generate_variations.py:/app/_generate_variations.py:ro" \
  -v "$TMP_DIR:/input:ro" \
  -v "$TMP_OUTPUT:/output" \
  -v "$INSIGHTFACE_CACHE:/cache" \
  "$DOCKER_IMAGE" \
  python3 /app/_generate_variations.py \
    /input/base_a.jpg \
    /input/base_b.jpg \
    /input/base_no_match.jpg \
    /output

# 生成成功後にアトミック置き換え（生成失敗時は既存フィクスチャを保持）
echo "$CACHE_KEY" > "$TMP_OUTPUT/.generator-version"
rm -rf "$PROJECT_DIR/$FIXTURES_DIR"
mv "$TMP_OUTPUT" "$PROJECT_DIR/$FIXTURES_DIR"

echo ""
echo "Done. Run 'bash scripts/load-fixtures-to-simulator.sh' to inject into the iOS simulator."
