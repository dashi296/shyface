#!/usr/bin/env bash
# テスト用顔写真を起動中の iOS シミュレーターのフォトライブラリに注入する。
# Maestro e2e フローで expo-image-picker がこれらの写真を選択できるようになる。
#
# 使い方:
#   bash scripts/load-fixtures-to-simulator.sh [device-udid]
#
#   device-udid を省略すると起動中の最初のシミュレーターを自動選択する。
#
# 事前条件:
#   - iOS シミュレーターが起動済みであること
#   - bash scripts/download-test-fixtures.sh が完了していること

set -euo pipefail

FIXTURES_DIR="e2e/fixtures/faces"

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

if [[ $# -ge 1 ]]; then
  UDID="$1"
else
  UDID=$(xcrun simctl list devices booted --json \
    | python3 -c "
import sys, json
devices = json.load(sys.stdin)['devices']
booted = [d for runtimes in devices.values() for d in runtimes if d['state'] == 'Booted']
if not booted:
    print('ERROR: no booted simulator found', file=sys.stderr)
    exit(1)
print(booted[0]['udid'])
")
fi

echo "=== Loading fixtures into simulator: $UDID ==="
echo ""

load() {
  echo "  addmedia: $1"
  xcrun simctl addmedia "$UDID" "$1"
}

echo "[registration]"
load "$FIXTURES_DIR/person_a/1_front.jpg"
load "$FIXTURES_DIR/person_a/2_left.jpg"
load "$FIXTURES_DIR/person_a/3_right.jpg"
load "$FIXTURES_DIR/person_b/1_front.jpg"
load "$FIXTURES_DIR/person_b/2_left.jpg"
load "$FIXTURES_DIR/person_b/3_right.jpg"

echo "[recognition]"
load "$FIXTURES_DIR/recognition/match_person_a.jpg"
load "$FIXTURES_DIR/recognition/match_person_b.jpg"
load "$FIXTURES_DIR/recognition/no_match.jpg"
load "$FIXTURES_DIR/recognition/group_ab.jpg"

echo ""
echo "Done. Photos are available in the simulator's photo library."
