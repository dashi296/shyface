#!/usr/bin/env bash
# テスト用顔写真を起動中の iOS シミュレーターのフォトライブラリに注入する。
# Maestro e2e フローで expo-image-picker がこれらの写真を選択できるようになる。
#
# 使い方:
#   bash scripts/load-fixtures-to-simulator.sh [device-udid] [--clean]
#
#   device-udid を省略すると起動中の iOS/iPadOS シミュレーターを自動選択する。
#   複数の iOS シミュレーターが起動中の場合は device-udid の指定が必須。
#   --clean を指定するとフォトライブラリ全体をクリアしてから注入する（CI 向け）。
#
# 事前条件:
#   - iOS シミュレーターが起動済みであること
#   - bash scripts/download-test-fixtures.sh が完了していること

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$PROJECT_DIR/e2e/fixtures/faces"

required_files=(
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

for f in "${required_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: fixture not found: $f"
    echo "Run 'bash scripts/download-test-fixtures.sh' first."
    exit 1
  fi
done

CLEAN=0
UDID=""
for arg in "$@"; do
  if [[ "$arg" == "--clean" ]]; then
    CLEAN=1
  elif [[ -z "$UDID" ]]; then
    UDID="$arg"
  fi
done

if [[ -z "$UDID" ]]; then
  UDID=$(xcrun simctl list devices booted --json \
    | python3 -c "
import sys, json
devices = json.load(sys.stdin)['devices']
# iOS / iPadOS シミュレーターのみ対象（Apple Watch などペアデバイスを除外）
booted = [
    d for runtime, runtimes in devices.items() for d in runtimes
    if d['state'] == 'Booted' and ('iOS' in runtime or 'iPadOS' in runtime)
]
if not booted:
    print('ERROR: 起動中の iOS/iPadOS シミュレーターがありません', file=sys.stderr)
    exit(1)
if len(booted) > 1:
    print('ERROR: 複数の iOS シミュレーターが起動しています。UDID を引数で指定してください:', file=sys.stderr)
    for d in booted:
        print('  ' + d['udid'] + '  (' + d['name'] + ')', file=sys.stderr)
    exit(1)
print(booted[0]['udid'])
")
fi

echo "=== Loading fixtures into simulator: $UDID ==="
echo ""

# 再実行時の写真重複を防ぐため、既存のメディアをクリアしてから注入する
DEVICE_DATA=$(xcrun simctl list devices --json \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
udid = '$UDID'
for devices in data['devices'].values():
    for d in devices:
        if d.get('udid') == udid:
            print(d.get('dataPath', ''))
            exit(0)
exit(1)
" 2>/dev/null || echo "")

if [[ -n "$DEVICE_DATA" && $CLEAN -eq 1 ]]; then
  # --clean: フォトライブラリ全体を削除する（CI 向け。既存の写真もすべて消える）
  if [[ -d "$DEVICE_DATA/Media/DCIM" ]] || [[ -d "$DEVICE_DATA/Media/PhotoData" ]]; then
    echo "WARNING: --clean が指定されたためフォトライブラリ全体をクリアします..."
    rm -rf "$DEVICE_DATA/Media/DCIM"
    rm -rf "$DEVICE_DATA/Media/PhotoData"
    echo ""
  fi
fi

load() {
  echo "  addmedia: $1"
  xcrun simctl addmedia "$UDID" "$1"
}

# iOS の Recents は「最後にロードした画像が先頭」に表示される。
# Maestro フローのヘルパーがグリッド先頭の座標で登録用写真を選べるよう、
# recognition 系（顔なし・集合写真を含む）を先に、登録用顔写真を後にロードする。
echo "[recognition]"
load "$FIXTURES_DIR/recognition/match_person_a.jpg"
load "$FIXTURES_DIR/recognition/match_person_b.jpg"
load "$FIXTURES_DIR/recognition/no_match.jpg"
load "$FIXTURES_DIR/recognition/group_ab.jpg"

# person_a を最後にロード → Recents 先頭3枚が person_a の顔写真になる
echo "[registration - person_b]"
load "$FIXTURES_DIR/person_b/1_front.jpg"
load "$FIXTURES_DIR/person_b/2_left.jpg"
load "$FIXTURES_DIR/person_b/3_right.jpg"

echo "[registration - person_a (Recents 先頭に配置)]"
load "$FIXTURES_DIR/person_a/1_front.jpg"
load "$FIXTURES_DIR/person_a/2_left.jpg"
load "$FIXTURES_DIR/person_a/3_right.jpg"

echo ""
echo "Done. Photos are available in the simulator's photo library."
