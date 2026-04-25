# scripts/ — FaceNet Fixture 生成スクリプト

## 概要

`gen_face_fixtures.py` は LFW（Labeled Faces in the Wild）データセットから FaceNet の embedding を生成し、
`__fixtures__/face_embeddings.json` として保存するスクリプト。

生成した JSON は Jest テスト（`faceRecognitionAccuracy.test.ts`）が読み込んで FAR / FRR / 正解率を計測する。

---

## LFW データセットの入手方法

1. [LFW 公式サイト](http://vis-www.cs.umass.edu/lfw/) にアクセス
2. **lfw-funneled.tgz**（アライン済み版）をダウンロード
3. **pairs.txt** をダウンロード
4. 任意のディレクトリに展開:

```
~/lfw/
├── pairs.txt
└── lfw_funneled/
    ├── Aaron_Eckhart/
    │   └── Aaron_Eckhart_0001.jpg
    └── ...
```

---

## 実行手順

```bash
# 依存パッケージのインストール（初回のみ）
cd scripts/
pip install -r requirements.txt

# fixture 生成
python gen_face_fixtures.py --lfw-root ~/lfw

# オプション: ペア数を指定する場合
python gen_face_fixtures.py --lfw-root ~/lfw --n-same 150 --n-diff 150

# pairs.txt が別の場所にある場合
python gen_face_fixtures.py --lfw-root ~/lfw --pairs ~/lfw/pairs.txt
```

生成後、`__fixtures__/face_embeddings.json` をコミットする:

```bash
git add __fixtures__/face_embeddings.json
git commit -m "chore: regenerate face embedding fixtures"
```

---

## fixture の再生成タイミング

| トリガー | 再生成 |
|---|---|
| `assets/models/facenet.tflite` を更新した | **必要** |
| `FACE_SIMILARITY_THRESHOLD` を変更した | **不要**（`bun test` を再実行するだけで新閾値での FAR/FRR が確認できる） |
| スクリプト自体を変更した | **必要** |

---

## Jest テストの確認

```bash
bun test src/shared/lib/__tests__/faceRecognitionAccuracy.test.ts
```

期待する出力:

```
顔認識精度レポート（FaceNet / LFW）
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
