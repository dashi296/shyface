# 顔認識スコア デバッグオーバーレイ — 設計スペック

## 概要

開発ビルド（`IS_DEV = true`）において、画像処理後の結果プレビュー画面で各顔の上に顔認識スコアと人物名をオーバーレイ表示する。精度チューニング（閾値・パディング調整）の際に目視確認を容易にするのが目的。本番ビルドでは一切描画しない。

---

## データ構造

```typescript
// features/image-processing/model/processImage.ts に定義・export する

type PersonResult = {
  personName: string
  score: number       // コサイン類似度（0〜1）
}

type FaceResult = {
  box: BoundingBox
  personResults: PersonResult[]      // 全登録人物とのスコア（score 降順）
  bestPersonResult: PersonResult | null  // personResults[0]。登録人物ゼロなら null
  matched: boolean                   // bestPersonResult.score > getThreshold()
}

type ProcessImageResult = {
  resultUri: string
  faceResults: FaceResult[]
  resizedScale: number   // resizeForMosaic が適用したスケール係数（座標変換に使用）
}
```

`bestPersonResult` は `matched` が `false`（閾値未満）でも常に設定する。登録人物が0人のときのみ `null`。

---

## processImage の変更

### 戻り値

`Promise<string>` → `Promise<ProcessImageResult>`

### 処理フロー

1. `FaceDetector.detect(uri)` で顔検出
2. 顔なし → `{ resultUri: uri, faceResults: [], resizedScale: 1 }` を返す
3. `cropFace` → `FaceNet.extractAll` で各顔の embedding を取得
4. `getAllEmbeddings()` と **`getAllPersons()`** を並列取得
5. `personId → name` マップを構築
6. `embeddingsByPerson`（`personId → number[][]`）を構築（既存ロジック流用）
7. 各顔について全登録人物とのスコアを計算し `FaceResult` を生成：
   - `personResults`：全人物のスコアを score 降順で並べる
   - `bestPersonResult`：`personResults[0] ?? null`
   - `matched`：`bestPersonResult.score > getThreshold()`
8. `regionsToBlur`：`faceResults` の `matched === true` な顔の box
9. 一致なし → `{ resultUri: uri, faceResults, resizedScale: 1 }` を返す
10. `resizeForMosaic(uri)` → `{ uri: resizedUri, scale }`
11. `Mosaic.apply(resizedUri, scaledRegions)` → `resultUri`
12. `{ resultUri, faceResults, resizedScale: scale }` を返す

### オプション引数

既存の `preloadedEmbeddings` に加え `preloadedPersons?: Person[]` を追加。バッチ処理時に DB クエリを1回にまとめられるようにする。

```typescript
export async function processImage(
  uri: string,
  preloadedEmbeddings?: Embedding[],
  preloadedPersons?: Person[],
): Promise<ProcessImageResult>
```

---

## 新規コンポーネント: FaceDebugOverlay

**配置**: `features/image-processing/ui/FaceDebugOverlay.tsx`

**責務**: `faceResults` と座標変換パラメータを受け取り、各顔の上に枠とラベルを描画する。**IS_DEV が false の場合は null を返す**（ツリーに残らない）。

### Props

```typescript
interface FaceDebugOverlayProps {
  faceResults: FaceResult[]
  containerSize: { width: number; height: number }  // 画像コンテナの表示サイズ
  imageSize: { width: number; height: number }       // resultUri の実ピクセルサイズ
  resizedScale: number
}
```

### 座標変換

```
displayScale = min(containerSize.width / imageSize.width,
                   containerSize.height / imageSize.height)
offsetX = (containerSize.width  - imageSize.width  * displayScale) / 2
offsetY = (containerSize.height - imageSize.height * displayScale) / 2

screenX = box.x * resizedScale * displayScale + offsetX
screenY = box.y * resizedScale * displayScale + offsetY
screenW = box.width  * resizedScale * displayScale
screenH = box.height * resizedScale * displayScale
```

座標変換ロジックは `computeOverlayBox(box, resizedScale, containerSize, imageSize)` として純粋関数に切り出し、ユニットテスト可能にする。

### 表示仕様

| 条件 | 枠色 | ラベル |
|---|---|---|
| `matched === true` | 赤（`#FF3B30`） | `"${bestPersonResult.personName}  ${Math.round(score * 100)}%"` |
| `matched === false` | 黄（`#FFD60A`） | `"${Math.round(bestPersonResult.score * 100)}%"` |
| `bestPersonResult === null` | 黄（`#FFD60A`） | `"—"` |

- ラベルは枠の上端左に `position: absolute` で配置
- 実装は純 RN の `View` + `Text`（Skia 不使用）
- `position: 'absolute'`・`top: 0`・`left: 0` で画像コンテナ全体に重ねる

---

## ProcessResultView の変更

### Props 追加

```typescript
interface ProcessResultViewProps {
  originalUri: string
  resultUri: string
  faceResults: FaceResult[]      // 追加
  resizedScale: number           // 追加
  onRetry?: () => void
}
```

### 変更内容

1. `imageWrapper` の `<View>` に `onLayout` を追加してコンテナサイズを state で保持
2. `<Image>` の `onLoad` で `Image.getSize(resultUri, ...)` を呼び実ピクセルサイズを state で保持
3. 両方が揃ったとき `<FaceDebugOverlay>` を `imageWrapper` 内に `position: absolute` で描画

---

## 影響範囲

| ファイル | 変更種別 |
|---|---|
| `features/image-processing/model/processImage.ts` | 変更（戻り値拡張） |
| `features/image-processing/model/useProcessImage.ts` | 型変更のみ |
| `features/image-processing/model/useProcessImages.ts` | 型変更・`preloadedPersons` 追加 |
| `features/image-processing/ui/ProcessResultView.tsx` | 変更（props 追加・オーバーレイ組み込み） |
| `features/image-processing/ui/ProcessBatchResultView.tsx` | `result.resultUri` 参照に変更 |
| `features/image-processing/ui/FaceDebugOverlay.tsx` | **新規作成** |
| `features/image-processing/index.ts` | `FaceResult` / `ProcessImageResult` / `PersonResult` を export |
| `app/process/[imageId].tsx` | `result.resultUri` / `result.faceResults` 等に変更 |
| `model/__tests__/processImage.test.ts` | アサーションを新戻り値に合わせて更新 |

---

## テスト方針

- `processImage` テスト：戻り値が `ProcessImageResult` 型であること、`faceResults[n].personResults` に全人物のスコアが降順で入ること、`matched` が閾値と一致すること
- `computeOverlayBox` テスト：座標変換の純粋関数をユニットテスト
- `FaceDebugOverlay` テスト：任意（dev-only コンポーネント）

---

## 対象外

- 本番ビルドでのスコア表示
- `personResults` の全人物リストを画面に表示する UI（デバッグ目的はラベルのみで十分）
- スコア表示のオン/オフ切り替えトグル（常時表示で十分）
