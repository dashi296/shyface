# e2e テスト用フィクスチャ

## 概要

AI 生成顔写真（架空人物）を使ったテストフィクスチャ。
Maestro e2e フローと Jest テストで共通して利用する。

画像ファイルは `.gitignore` に含まれているため、初回セットアップ時にダウンロードが必要。

## セットアップ

```bash
# Step 1: AI 生成顔をダウンロード・バリエーション生成（約 10 秒）
bash scripts/download-test-fixtures.sh

# Step 2: iOS シミュレーターが起動済みの状態で写真をフォトライブラリに注入
bash scripts/load-fixtures-to-simulator.sh
```

または一括実行:

```bash
bun run e2e:setup
```

## ディレクトリ構成

```
e2e/fixtures/faces/
├── person_a/
│   ├── 1_front.jpg  # 同一人物・正面（登録用）
│   ├── 2_left.jpg   # 同一人物・左斜め ≈ 20°（登録用）
│   └── 3_right.jpg  # 同一人物・右斜め ≈ 20°（登録用）
├── person_b/
│   ├── 1_front.jpg  # 同一人物・正面（登録用）
│   ├── 2_left.jpg   # 同一人物・左斜め ≈ 20°（登録用）
│   └── 3_right.jpg  # 同一人物・右斜め ≈ 20°（登録用）
└── recognition/
    ├── match_person_a.jpg  # person_a と一致するはず → ブラーされる
    ├── match_person_b.jpg  # person_b と一致するはず → ブラーされる
    ├── no_match.jpg        # どちらとも一致しない別人 → ブラーされない
    └── group_ab.jpg        # person_a + person_b の横並び合成 → 両方ブラーされる
```

## 生成の仕組み

```
thispersondoesnotexist.com
  → base_a.jpg  (1枚ダウンロード)
        ↓ numpy + Pillow 透視変換
        ├── person_a/1_front.jpg   (そのまま・正面)
        ├── person_a/2_left.jpg    (右辺を ~22% 圧縮 → 左向き ≈ 20°)
        ├── person_a/3_right.jpg   (左辺を ~22% 圧縮 → 右向き ≈ 20°)
        └── recognition/match_person_a.jpg  (彩度 +20% + シャープネス)

  → base_b.jpg  (1枚ダウンロード)
        ↓ 同様に変形
        ├── person_b/1_front.jpg 〜 3_right.jpg
        └── recognition/match_person_b.jpg

  → base_no_match.jpg  (1枚ダウンロード、そのまま使用)
        └── recognition/no_match.jpg

recognition/group_ab.jpg = base_a + base_b を 512x512 で横並び合成
```

透視変換は Pillow の backward mapping（出力座標 → 入力座標）を使用。
FaceNet は ±30° 程度の頭部回転に対してロバストなため、
同一ベース画像の角度バリエーションでもコサイン類似度は閾値（0.6〜0.7）を超える。

## Maestro テストでの対応表

| テストシナリオ | 使用する登録画像 | 使用する認識画像 | 期待結果 |
|---|---|---|---|
| person_a が認識される | person_a/{1_front, 2_left, 3_right}.jpg | recognition/match_person_a.jpg | 顔がブラーされる |
| person_b が認識される | person_b/{1_front, 2_left, 3_right}.jpg | recognition/match_person_b.jpg | 顔がブラーされる |
| 未登録人物はブラーされない | person_a/{1_front, 2_left, 3_right}.jpg | recognition/no_match.jpg | ブラーされない |
| 2人写りの画像で登録者だけブラー | person_a/{1_front, 2_left, 3_right}.jpg | recognition/group_ab.jpg | person_a のみブラー |

## Jest でのフィクスチャパス

```typescript
import path from 'path'

const FIXTURES = {
  personA: ['1_front', '2_left', '3_right'].map(n =>
    path.join(__dirname, `../../e2e/fixtures/faces/person_a/${n}.jpg`)
  ),
  recognition: {
    matchA:   path.join(__dirname, '../../e2e/fixtures/faces/recognition/match_person_a.jpg'),
    noMatch:  path.join(__dirname, '../../e2e/fixtures/faces/recognition/no_match.jpg'),
    groupAb:  path.join(__dirname, '../../e2e/fixtures/faces/recognition/group_ab.jpg'),
  },
}
```

ネイティブモジュール（FaceDetector, FaceNet）はモック済みのため、
Jest の結果は実際の画像内容に依存しない。

## 注意事項

- 素材はすべて [thispersondoesnotexist.com](https://thispersondoesnotexist.com/) の AI 生成画像（架空の人物）
- ダウンロードするたびに異なる顔が生成されるため、再実行するとセット全体が変わる
- 既にファイルが揃っている場合、スクリプトはスキップする（冪等）
