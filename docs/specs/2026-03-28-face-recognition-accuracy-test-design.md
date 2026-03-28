# FaceNet Embedding 精度テスト基盤 — 設計スペック

**作成日**: 2026-03-28
**関連 issue**: dashi296/shyface#49

---

## 背景

現在の Jest テストでは FaceDetector・FaceNet・cosineSimilarity がすべてモックされており、FaceNet モデルが実際の顔画像から生成する embedding の品質を検証する手段がない。

モデルのアップデートや閾値（`FACE_SIMILARITY_THRESHOLD`）の調整を行う際に、顔認識精度の変化を定量的に確認できる仕組みが必要。

---

## 目標

- 同一人物の顔画像ペア → cosine similarity が高い（> threshold）ことを確認できる
- 別人の顔画像ペア → cosine similarity が低い（≤ threshold）ことを確認できる
- FAR（他人を本人と誤判定する率）・FRR（本人を弾く率）・正解率を計測・出力できる
- 現時点は「計測できる状態」を作ることが目標。合格基準（FAR ≤ X% など）は計測結果を見てから決める

---

## スコープ

**対象**: FaceNet モデル単体の embedding 品質
**対象外**: 顔検出（FaceDetector）を含むパイプライン全体の精度（別 issue で扱う）

LFW（Labeled Faces in the Wild）はアライン済みの顔画像を提供するため、検出+クロップステップをスキップして FaceNet に直接入力する。この制約は fixture のメタデータに明記する。

---

## 採用アプローチ

**Python fixture 生成 + Jest 精度レポート**

LFW の公開データセットから Python スクリプトで embedding を生成し、JSON fixture としてリポジトリにコミットする。Jest テストは fixture を読むだけで動作するため、CI では `bun test` のみで精度チェックが完結する。Python スクリプトは fixture の再生成時（モデル更新時）のみ実行する。

### 採用理由

- 環境構築が最小（CI は `bun test` のみ）
- Python は fixture 再生成時のみ必要
- 合格基準の追加は `expect(far).toBeLessThan(X)` の1行で済む

### 不採用アプローチ

| アプローチ | 不採用理由 |
|---|---|
| CI で毎回 Python 実行 | CI が重い（LFW DL + TFLite 推論）|
| Jest 内で `@tensorflow/tfjs-node` 推論 | モデル互換性が不確か・バイナリが重い |

---

## ファイル構成

```
shyface/
├── scripts/
│   ├── gen_face_fixtures.py      # LFW から embedding を生成・JSON 保存
│   ├── requirements.txt          # 依存パッケージ
│   └── README.md                 # LFW 入手方法・実行手順・再生成タイミング
├── __fixtures__/
│   └── face_embeddings.json      # 生成済み embedding（コミット対象）
└── src/shared/lib/__tests__/
    └── faceRecognitionAccuracy.test.ts  # Jest 精度計測テスト
```

---

## データフロー

```
LFW dataset（pairs.txt + 画像）
  → gen_face_fixtures.py（Python / ローカルで一度だけ実行）
      → facenet.tflite で推論
      → 同一人物ペア・別人ペアの embedding を JSON に保存
  → face_embeddings.json（リポジトリにコミット）
  → faceRecognitionAccuracy.test.ts（bun test で常時実行）
      → cosineSimilarity を計算
      → FAR / FRR / 正解率を console.table で出力
      → 現時点は pass（閾値チェックなし）
```

---

## fixture フォーマット

```json
{
  "_meta": {
    "scope": "FaceNet model accuracy only (face detection step excluded)",
    "dataset": "LFW",
    "model": "facenet.tflite",
    "generated_at": "<スクリプトが自動生成>",
    "note": "LFW images are pre-aligned. Full pipeline (detect→crop→embed) is not covered."
  },
  "same_pairs": [
    { "a": [/* 128次元 embedding */], "b": [/* 128次元 embedding */] }
  ],
  "diff_pairs": [
    { "a": [/* 128次元 embedding */], "b": [/* 128次元 embedding */] }
  ]
}
```

**サイズ目安**: 128次元 × 300ペア（同一150 + 別人150）≈ 約 600KB

---

## Python スクリプトの前処理

`FaceNet.ts` の `uriToFloat32Input` と一致させる。

```python
# NOTE: Skia と Pillow のリサイズ結果は完全一致しないが、embedding への影響は軽微。
# Skia の補間に最も近い BILINEAR を使用する。
img = Image.open(path).convert("RGB")
img = img.resize((160, 160), Image.BILINEAR)
pixels = np.array(img, dtype=np.float32)
normalized = (pixels - 128.0) / 128.0           # FaceNet.ts と同じ正規化式
input_tensor = normalized[np.newaxis, ...]      # shape: (1, 160, 160, 3)
```

### 依存パッケージ（requirements.txt）

```
# Python 3.9–3.11 推奨
# M1/M2 Mac の場合: pip install tensorflow-macos の利用を推奨
tflite-runtime>=2.13   # または tensorflow>=2.13（フォールバック）
pillow>=9.0
numpy>=1.24
```

---

## fixture 再生成のトリガー

`assets/models/facenet.tflite` を更新したときのみ fixture を再生成する。

`FACE_SIMILARITY_THRESHOLD` の変更は fixture 再生成不要。`bun test` を再実行すれば新閾値での FAR/FRR が確認できる。

---

## LFW の期待するディレクトリ構造

```
lfw/
├── pairs.txt             # 公式ペアファイル（6000ペア定義）
└── lfw_funneled/         # または lfw/（バージョンによる）
    └── Aaron_Eckhart/
        └── Aaron_Eckhart_0001.jpg
```

---

## Jest テストの出力イメージ

```
顔認識精度レポート（FaceNet / LFW 150+150ペア）
┌─────────────────┬────────┐
│ 指標            │ 値     │
├─────────────────┼────────┤
│ 正解率 (Acc)    │ 92.3%  │
│ FAR             │  5.3%  │
│ FRR             │ 10.0%  │
│ 同一人物 avg sim│  0.74  │
│ 別人 avg sim    │  0.41  │
└─────────────────┴────────┘
```

---

## 実装タスク

- [ ] `scripts/requirements.txt` を作成
- [ ] `scripts/gen_face_fixtures.py` を実装（LFW pairs.txt の読み込み・前処理・TFLite 推論・JSON 出力）
- [ ] `scripts/README.md` に LFW の入手方法・実行手順・再生成タイミングを記載
- [ ] `gen_face_fixtures.py` を一度実行し `__fixtures__/face_embeddings.json` を生成・コミット
- [ ] `src/shared/lib/__tests__/faceRecognitionAccuracy.test.ts` を実装
- [ ] `bun test` で精度レポートが出力されることを確認

---

## 将来の拡張

- FAR / FRR の合格基準（`expect(far).toBeLessThan(X)`）を追加する
- ペア数を増やして統計的信頼性を高める
- 顔検出を含むパイプライン全体の精度テストを別途追加する
