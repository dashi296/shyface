# Face Score Debug Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 開発ビルドの画像処理結果プレビューで、検出された各顔の上に全登録人物とのスコアと人物名をオーバーレイ表示する。

**Architecture:** `processImage` の戻り値を `ProcessImageResult`（resultUri + faceResults[] + resizedScale）に拡張し、`ProcessResultView` に `FaceDebugOverlay` コンポーネントを重ねて描画する。座標変換（元画像座標 → 画面座標）は純粋関数 `computeOverlayBox` に切り出す。`FaceDebugOverlay` は IS_DEV が false のとき null を返すため本番ビルドに影響しない。

**Tech Stack:** React Native (View / Text / Image), expo-constants (IS_DEV), expo-sqlite (in-memory for tests), Jest + React Native Testing Library

---

## File Map

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/features/image-processing/model/processImage.ts` | 変更 | 型定義追加・戻り値を ProcessImageResult に変更 |
| `src/features/image-processing/model/__tests__/processImage.test.ts` | 変更 | 既存テストの result 参照を result.resultUri に変更、新テスト追加 |
| `src/features/image-processing/ui/overlayUtils.ts` | 新規 | computeOverlayBox 純粋関数 |
| `src/features/image-processing/ui/__tests__/overlayUtils.test.ts` | 新規 | computeOverlayBox ユニットテスト |
| `src/features/image-processing/ui/FaceDebugOverlay.tsx` | 新規 | dev-only オーバーレイコンポーネント |
| `src/features/image-processing/ui/ProcessResultView.tsx` | 変更 | props 追加・FaceDebugOverlay 組み込み |
| `src/features/image-processing/model/useProcessImages.ts` | 変更 | persons 事前取得・ImageProcessResult 型更新 |
| `src/features/image-processing/model/__tests__/useProcessImages.test.ts` | 変更 | processImage モック戻り値を ProcessImageResult 形式に変更 |
| `src/features/image-processing/index.ts` | 変更 | PersonResult / FaceResult / ProcessImageResult を export |
| `app/process/[imageId].tsx` | 変更 | result.resultUri / result.faceResults / result.resizedScale に変更 |

---

## Task 1: processImage の型定義と実装を更新する

**Files:**
- Modify: `src/features/image-processing/model/processImage.ts`
- Modify: `src/features/image-processing/model/__tests__/processImage.test.ts`

### 既存テストの修正（失敗することを確認してから実装する）

- [ ] **Step 1: 既存テストの `result` 参照を修正する**

`src/features/image-processing/model/__tests__/processImage.test.ts` の以下の箇所を変更する。

```typescript
// 変更前
const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])
expect(result).toBe('file://original.jpg')

// 変更後（no faces detected テスト）
const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])
expect(result.resultUri).toBe('file://original.jpg')
expect(result.faceResults).toEqual([])
expect(result.resizedScale).toBe(1)
```

`does not blur face when no embedding exceeds threshold` テストの末尾:

```typescript
// 変更前
expect(result).toBe('file://original.jpg')

// 変更後
expect(result.resultUri).toBe('file://original.jpg')
```

`does not blur when similarity equals threshold exactly` テストの末尾:

```typescript
// 変更前
expect(result).toBe('file://original.jpg')

// 変更後
expect(result.resultUri).toBe('file://original.jpg')
```

`preloadedEmbeddings > uses preloaded embeddings` テストの末尾 `expect(Mosaic.apply).toHaveBeenCalled()` はそのまま（resultUri を見ていないため変更不要）。

- [ ] **Step 2: テストが失敗することを確認する**

```bash
bun test src/features/image-processing/model/__tests__/processImage.test.ts --no-coverage
```

Expected: 型エラーまたはアサーション失敗（`result.resultUri` が undefined になる）

### processImage の型定義と実装

- [ ] **Step 3: processImage.ts を全面書き換えする**

```typescript
// src/features/image-processing/model/processImage.ts
import { FaceDetector, FaceNet, Mosaic } from '@/shared/native'
import { getAllEmbeddings, getAllPersons } from '@/shared/db'
import type { Embedding, Person } from '@/shared/db'
import { cosineSimilarity, cropFace, resizeForMosaic } from '@/shared/lib'
import { getThreshold } from '@/shared/config'
import type { BoundingBox } from '@/shared/native'

export type PersonResult = {
  personName: string
  score: number
}

export type FaceResult = {
  box: BoundingBox
  personResults: PersonResult[]       // 全登録人物とのスコア（score 降順）
  bestPersonResult: PersonResult | null  // personResults[0]。登録人物ゼロなら null
  matched: boolean                    // bestPersonResult.score > getThreshold()
}

export type ProcessImageResult = {
  resultUri: string
  faceResults: FaceResult[]
  resizedScale: number
}

export async function processImage(
  uri: string,
  preloadedEmbeddings?: Embedding[],
  preloadedPersons?: Person[],
): Promise<ProcessImageResult> {
  const boxes = await FaceDetector.detect(uri)
  if (boxes.length === 0) return { resultUri: uri, faceResults: [], resizedScale: 1 }

  const croppedUris = await Promise.all(boxes.map((box) => cropFace(uri, box)))
  const faceEmbeddings = await FaceNet.extractAll(croppedUris)

  if (faceEmbeddings.length !== boxes.length) {
    throw new Error(
      `[processImage] FaceNet embedding count mismatch: expected ${boxes.length}, got ${faceEmbeddings.length}`
    )
  }

  const [storedEmbeddings, persons] = await Promise.all([
    preloadedEmbeddings ? Promise.resolve(preloadedEmbeddings) : getAllEmbeddings(),
    preloadedPersons ? Promise.resolve(preloadedPersons) : getAllPersons(),
  ])

  const personNames = new Map(persons.map((p) => [p.id, p.name]))

  const embeddingsByPerson = storedEmbeddings.reduce<Record<string, number[][]>>(
    (acc, stored) => {
      let vec: number[]
      try {
        vec = JSON.parse(stored.embedding)
      } catch (e) {
        console.error('[processImage] Corrupt embedding record skipped', {
          embeddingId: stored.id,
          personId: stored.person_id,
          error: e,
        })
        return acc
      }
      ;(acc[stored.person_id] ??= []).push(vec)
      return acc
    },
    {}
  )

  const threshold = getThreshold()

  const faceResults: FaceResult[] = boxes.map((box, i) => {
    const personResults: PersonResult[] = Object.entries(embeddingsByPerson)
      .map(([personId, vecs]) => {
        const maxScore = Math.max(...vecs.map((v) => cosineSimilarity(faceEmbeddings[i], v)))
        return { personName: personNames.get(personId) ?? personId, score: maxScore }
      })
      .sort((a, b) => b.score - a.score)

    const bestPersonResult = personResults[0] ?? null
    const matched = bestPersonResult !== null && bestPersonResult.score > threshold

    return { box, personResults, bestPersonResult, matched }
  })

  const regionsToBlur = boxes.filter((_, i) => faceResults[i].matched)

  if (regionsToBlur.length === 0) return { resultUri: uri, faceResults, resizedScale: 1 }

  const { uri: resizedUri, scale } = await resizeForMosaic(uri)
  const scaledRegions = regionsToBlur.map((box) => ({
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }))
  const resultUri = await Mosaic.apply(resizedUri, scaledRegions)
  return { resultUri, faceResults, resizedScale: scale }
}
```

- [ ] **Step 4: 既存テストがパスすることを確認する**

```bash
bun test src/features/image-processing/model/__tests__/processImage.test.ts --no-coverage
```

Expected: 全テスト PASS

### faceResults の新規テストを追加する

- [ ] **Step 5: processImage.test.ts に faceResults を検証するテストを追加する**

ファイル末尾の `})` の直前に追加する（`describe('robustness', ...)` ブロックの後）:

```typescript
  describe('faceResults', () => {
    it('returns faceResults with personResults sorted by score descending', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      // p1: 0.8, p2: 0.4 → p1 が先頭になるはず
      cosineSimilarity
        .mockReturnValueOnce(0.8)  // face vs p1
        .mockReturnValueOnce(0.4)  // face vs p2

      const result = await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p2'),
      ])

      expect(result.faceResults).toHaveLength(1)
      const face = result.faceResults[0]
      expect(face.personResults).toHaveLength(2)
      expect(face.personResults[0].score).toBeGreaterThan(face.personResults[1].score)
      expect(face.personResults[0].score).toBeCloseTo(0.8)
      expect(face.personResults[1].score).toBeCloseTo(0.4)
    })

    it('sets bestPersonResult to the highest-scoring person even when not matched', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.3) // 閾値(0.6)未満 → matched: false

      const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      const face = result.faceResults[0]
      expect(face.matched).toBe(false)
      expect(face.bestPersonResult).not.toBeNull()
      expect(face.bestPersonResult?.score).toBeCloseTo(0.3)
    })

    it('sets bestPersonResult to null when no persons are registered', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      const result = await processImage('file://original.jpg', []) // embeddings 空

      const face = result.faceResults[0]
      expect(face.bestPersonResult).toBeNull()
      expect(face.matched).toBe(false)
      expect(face.personResults).toHaveLength(0)
    })

    it('uses person name from DB when preloadedPersons is provided', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.9)

      const preloadedPersons = [{ id: 'p1', name: '田中 太郎', memo: null, created_at: NOW, updated_at: NOW }]

      const result = await processImage(
        'file://original.jpg',
        [makeStoredEmbedding('1', 'p1')],
        preloadedPersons,
      )

      expect(result.faceResults[0].bestPersonResult?.personName).toBe('田中 太郎')
    })

    it('returns resizedScale from resizeForMosaic when faces are blurred', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity, resizeForMosaic } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95)
      resizeForMosaic.mockResolvedValue({ uri: 'file://resized.jpg', scale: 0.75 })

      const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(result.resizedScale).toBe(0.75)
    })

    it('returns resizedScale of 1 when no faces are blurred', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.3)

      const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(result.resizedScale).toBe(1)
      expect(result.resultUri).toBe('file://original.jpg')
    })
  })
```

- [ ] **Step 6: テストをすべて実行して PASS を確認する**

```bash
bun test src/features/image-processing/model/__tests__/processImage.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 7: コミットする**

```bash
git add src/features/image-processing/model/processImage.ts \
        src/features/image-processing/model/__tests__/processImage.test.ts
git commit -m "feat: extend processImage to return ProcessImageResult with faceResults"
```

---

## Task 2: computeOverlayBox 純粋関数を実装する

**Files:**
- Create: `src/features/image-processing/ui/overlayUtils.ts`
- Create: `src/features/image-processing/ui/__tests__/overlayUtils.test.ts`

- [ ] **Step 1: テストファイルを作成する**

```typescript
// src/features/image-processing/ui/__tests__/overlayUtils.test.ts
import { computeOverlayBox } from '../overlayUtils'

describe('computeOverlayBox', () => {
  it('maps box from original coords to screen coords with no letterboxing', () => {
    // 画像: 400x400, コンテナ: 400x400 → displayScale=1, offset=0
    const result = computeOverlayBox(
      { x: 100, y: 50, width: 80, height: 80 },
      1,
      { width: 400, height: 400 },
      { width: 400, height: 400 },
    )
    expect(result).toEqual({ x: 100, y: 50, width: 80, height: 80 })
  })

  it('applies resizedScale before display scaling', () => {
    // resizedScale=0.5 → 元座標を半分にしてから display scaling
    // 画像(resized): 200x200, コンテナ: 200x200 → displayScale=1
    const result = computeOverlayBox(
      { x: 100, y: 100, width: 50, height: 50 },
      0.5,
      { width: 200, height: 200 },
      { width: 200, height: 200 },
    )
    expect(result).toEqual({ x: 50, y: 50, width: 25, height: 25 })
  })

  it('applies contain-mode displayScale when image is wider than container', () => {
    // 画像: 800x400, コンテナ: 400x400 → displayScale=min(400/800,400/400)=0.5
    // offsetX=(400-800*0.5)/2=0, offsetY=(400-400*0.5)/2=100
    const result = computeOverlayBox(
      { x: 200, y: 100, width: 100, height: 100 },
      1,
      { width: 400, height: 400 },
      { width: 800, height: 400 },
    )
    expect(result.x).toBeCloseTo(100)  // 200*0.5 + 0
    expect(result.y).toBeCloseTo(150)  // 100*0.5 + 100
    expect(result.width).toBeCloseTo(50)
    expect(result.height).toBeCloseTo(50)
  })

  it('applies letterbox offset when image is taller than container', () => {
    // 画像: 400x800, コンテナ: 400x400 → displayScale=min(400/400,400/800)=0.5
    // offsetX=(400-400*0.5)/2=100, offsetY=(400-800*0.5)/2=0
    const result = computeOverlayBox(
      { x: 100, y: 200, width: 80, height: 80 },
      1,
      { width: 400, height: 400 },
      { width: 400, height: 800 },
    )
    expect(result.x).toBeCloseTo(150)  // 100*0.5 + 100
    expect(result.y).toBeCloseTo(100)  // 200*0.5 + 0
    expect(result.width).toBeCloseTo(40)
    expect(result.height).toBeCloseTo(40)
  })

  it('combines resizedScale and display scaling correctly', () => {
    // resizedScale=0.5, 画像(resized): 400x400, コンテナ: 200x200 → displayScale=0.5
    // 元画像 box.x=200 → resized: 100 → screen: 100*0.5+0 = 50
    const result = computeOverlayBox(
      { x: 200, y: 200, width: 100, height: 100 },
      0.5,
      { width: 200, height: 200 },
      { width: 400, height: 400 },
    )
    expect(result.x).toBeCloseTo(50)
    expect(result.y).toBeCloseTo(50)
    expect(result.width).toBeCloseTo(25)
    expect(result.height).toBeCloseTo(25)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
bun test src/features/image-processing/ui/__tests__/overlayUtils.test.ts --no-coverage
```

Expected: FAIL（`computeOverlayBox` が存在しない）

- [ ] **Step 3: overlayUtils.ts を実装する**

```typescript
// src/features/image-processing/ui/overlayUtils.ts
import type { BoundingBox } from '@/shared/native'

type Size = { width: number; height: number }
type OverlayBox = { x: number; y: number; width: number; height: number }

export function computeOverlayBox(
  box: BoundingBox,
  resizedScale: number,
  containerSize: Size,
  imageSize: Size,
): OverlayBox {
  const displayScale = Math.min(
    containerSize.width / imageSize.width,
    containerSize.height / imageSize.height,
  )
  const offsetX = (containerSize.width - imageSize.width * displayScale) / 2
  const offsetY = (containerSize.height - imageSize.height * displayScale) / 2

  return {
    x: box.x * resizedScale * displayScale + offsetX,
    y: box.y * resizedScale * displayScale + offsetY,
    width: box.width * resizedScale * displayScale,
    height: box.height * resizedScale * displayScale,
  }
}
```

- [ ] **Step 4: テストがパスすることを確認する**

```bash
bun test src/features/image-processing/ui/__tests__/overlayUtils.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/features/image-processing/ui/overlayUtils.ts \
        src/features/image-processing/ui/__tests__/overlayUtils.test.ts
git commit -m "feat: add computeOverlayBox utility for face debug overlay coordinate mapping"
```

---

## Task 3: FaceDebugOverlay コンポーネントを作成する

**Files:**
- Create: `src/features/image-processing/ui/FaceDebugOverlay.tsx`

- [ ] **Step 1: FaceDebugOverlay.tsx を作成する**

```typescript
// src/features/image-processing/ui/FaceDebugOverlay.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Constants from 'expo-constants'
import { computeOverlayBox } from './overlayUtils'
import type { FaceResult } from '../model/processImage'

const IS_DEV = Constants.expoConfig?.extra?.isDev === true

interface FaceDebugOverlayProps {
  faceResults: FaceResult[]
  containerSize: { width: number; height: number }
  imageSize: { width: number; height: number }
  resizedScale: number
}

export function FaceDebugOverlay({
  faceResults,
  containerSize,
  imageSize,
  resizedScale,
}: FaceDebugOverlayProps) {
  if (!IS_DEV) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {faceResults.map((face, i) => {
        const box = computeOverlayBox(face.box, resizedScale, containerSize, imageSize)
        const borderColor = face.matched ? '#FF3B30' : '#FFD60A'
        const backgroundColor = face.matched
          ? 'rgba(255,59,48,0.1)'
          : 'rgba(255,214,10,0.08)'
        const labelBg = face.matched ? '#FF3B30' : '#FFD60A'
        const labelColor = face.matched ? '#fff' : '#000'

        let label: string
        if (face.bestPersonResult === null) {
          label = '—'
        } else if (face.matched) {
          label = `${face.bestPersonResult.personName}  ${Math.round(face.bestPersonResult.score * 100)}%`
        } else {
          label = `${Math.round(face.bestPersonResult.score * 100)}%`
        }

        return (
          <View
            key={i}
            style={[
              styles.faceBox,
              {
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                borderColor,
                backgroundColor,
              },
            ]}
          >
            <Text
              style={[styles.label, { backgroundColor: labelBg, color: labelColor }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  faceBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 2,
  },
  label: {
    position: 'absolute',
    top: -18,
    left: 0,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
})
```

- [ ] **Step 2: 型チェックを実行する**

```bash
bun run tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミットする**

```bash
git add src/features/image-processing/ui/FaceDebugOverlay.tsx
git commit -m "feat: add FaceDebugOverlay component for dev build face score visualization"
```

---

## Task 4: ProcessResultView に FaceDebugOverlay を組み込む

**Files:**
- Modify: `src/features/image-processing/ui/ProcessResultView.tsx`

- [ ] **Step 1: ProcessResultView.tsx を全面書き換えする**

```typescript
// src/features/image-processing/ui/ProcessResultView.tsx
import React, { useState } from 'react'
import {
  View,
  Image,
  Text,
  StyleSheet,
  Share,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native'
import type { FaceResult } from '../model/processImage'
import { FaceDebugOverlay } from './FaceDebugOverlay'

interface ProcessResultViewProps {
  originalUri: string
  resultUri: string
  faceResults: FaceResult[]
  resizedScale: number
  onRetry?: () => void
}

export function ProcessResultView({
  originalUri: _originalUri,
  resultUri,
  faceResults,
  resizedScale,
  onRetry,
}: ProcessResultViewProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setContainerSize({ width, height })
  }

  const handleImageLoad = () => {
    Image.getSize(resultUri, (width, height) => {
      setImageSize({ width, height })
    })
  }

  const handleShare = async () => {
    try {
      await Share.share({ url: resultUri })
    } catch {
      // share cancelled
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper} onLayout={handleLayout}>
        <Image
          source={{ uri: resultUri }}
          style={styles.image}
          resizeMode="contain"
          onLoad={handleImageLoad}
        />
        {containerSize && imageSize && (
          <FaceDebugOverlay
            faceResults={faceResults}
            containerSize={containerSize}
            imageSize={imageSize}
            resizedScale={resizedScale}
          />
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={handleShare}>
          <Text style={styles.buttonText}>共有する</Text>
        </TouchableOpacity>
        {onRetry && (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onRetry}>
            <Text style={[styles.buttonText, styles.secondaryText]}>別の画像を選択</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageWrapper: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, width: '100%' },
  actions: { padding: 20, gap: 12 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#333' },
})
```

- [ ] **Step 2: 型チェックを実行する**

```bash
bun run tsc --noEmit
```

Expected: `app/process/[imageId].tsx` で props 不足のエラーが出る（Task 6 で修正する）

- [ ] **Step 3: コミットする**

```bash
git add src/features/image-processing/ui/ProcessResultView.tsx
git commit -m "feat: integrate FaceDebugOverlay into ProcessResultView"
```

---

## Task 5: useProcessImages と ImageProcessResult 型を更新する

**Files:**
- Modify: `src/features/image-processing/model/useProcessImages.ts`
- Modify: `src/features/image-processing/model/__tests__/useProcessImages.test.ts`

- [ ] **Step 1: useProcessImages.test.ts のモック戻り値を ProcessImageResult 形式に変更する**

`processImage` のモック戻り値をすべて `{ resultUri, faceResults, resizedScale }` 形式に変更し、データアサーションも更新する。

```typescript
// ファイル冒頭のモック設定はそのまま

// 'returns success results for all images' テスト:
processImage
  .mockResolvedValueOnce({ resultUri: 'file://result1.jpg', faceResults: [], resizedScale: 1 })
  .mockResolvedValueOnce({ resultUri: 'file://result2.jpg', faceResults: [], resizedScale: 1 })

// アサーション:
expect(result.current.data).toEqual([
  { status: 'success', originalUri: 'file://a.jpg', resultUri: 'file://result1.jpg', faceResults: [], resizedScale: 1 },
  { status: 'success', originalUri: 'file://b.jpg', resultUri: 'file://result2.jpg', faceResults: [], resizedScale: 1 },
])

// 'continues processing remaining images when one fails' テスト:
processImage
  .mockRejectedValueOnce(new Error('native error'))
  .mockResolvedValueOnce({ resultUri: 'file://result2.jpg', faceResults: [], resizedScale: 1 })

// アサーション:
expect(result.current.data).toEqual([
  { status: 'error', originalUri: 'file://a.jpg', resultUri: 'file://a.jpg', error: 'native error' },
  { status: 'success', originalUri: 'file://b.jpg', resultUri: 'file://result2.jpg', faceResults: [], resizedScale: 1 },
])

// 'uses preloaded embeddings' テスト:
processImage.mockResolvedValue({ resultUri: 'file://result.jpg', faceResults: [], resizedScale: 1 })

// 'calls getAllEmbeddings only once' テスト:
processImage.mockResolvedValue({ resultUri: 'file://result.jpg', faceResults: [], resizedScale: 1 })

// 'tracks progress' テスト:
processImage.mockResolvedValue({ resultUri: 'file://result.jpg', faceResults: [], resizedScale: 1 })

// 'resolves as success even when all images fail' テスト はアサーション変更なし（error ケースは resultUri のみ）

// 'stores error message as string' テスト はアサーション変更なし
```

また、`getAllPersons` のプリロードを検証する新規テストを追加する:

```typescript
  it('passes preloaded persons to processImage for each image in the batch', async () => {
    await seedEmbedding()
    const { processImage } = require('../processImage')
    processImage.mockResolvedValue({ resultUri: 'file://result.jpg', faceResults: [], resizedScale: 1 })

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // 第3引数に persons 配列が渡されていることを確認
    expect(processImage).toHaveBeenCalledWith(
      'file://a.jpg',
      expect.any(Array), // preloadedEmbeddings
      expect.arrayContaining([expect.objectContaining({ id: 'p1', name: 'Test' })]),
    )
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
bun test src/features/image-processing/model/__tests__/useProcessImages.test.ts --no-coverage
```

Expected: FAIL（mock が `'file://result.jpg'` を返しているため `result.resultUri` が undefined）

- [ ] **Step 3: useProcessImages.ts を更新する**

```typescript
// src/features/image-processing/model/useProcessImages.ts
import { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { getAllEmbeddings, getAllPersons } from '@/shared/db'
import { processImage } from './processImage'
import type { FaceResult } from './processImage'

export type ImageProcessResult =
  | { status: 'success'; originalUri: string; resultUri: string; faceResults: FaceResult[]; resizedScale: number }
  | { status: 'error'; originalUri: string; resultUri: string; error: string }

export type ProcessProgress = {
  current: number
  total: number
}

export function useProcessImages() {
  const [progress, setProgress] = useState<ProcessProgress>({ current: 0, total: 0 })
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const mutation = useMutation({
    mutationFn: async (uris: string[]): Promise<ImageProcessResult[]> => {
      if (uris.length === 0) return []

      // バッチ処理全体で共通の Embedding / Person を事前取得（N回の DB 読み込みを1回に削減）
      const [storedEmbeddings, storedPersons] = await Promise.all([
        getAllEmbeddings(),
        getAllPersons(),
      ])
      if (storedEmbeddings.length === 0) {
        console.warn('[useProcessImages] getAllEmbeddings returned empty — no face matching will occur')
      }

      const results: ImageProcessResult[] = []
      for (let i = 0; i < uris.length; i++) {
        if (isMountedRef.current) setProgress({ current: i + 1, total: uris.length })
        const uri = uris[i]
        try {
          const imageResult = await processImage(uri, storedEmbeddings, storedPersons)
          results.push({
            status: 'success',
            originalUri: uri,
            resultUri: imageResult.resultUri,
            faceResults: imageResult.faceResults,
            resizedScale: imageResult.resizedScale,
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[useProcessImages] Failed to process image', { uri, error: e })
          results.push({ status: 'error', originalUri: uri, resultUri: uri, error: message })
        }
      }

      return results
    },
    onError: (error: Error) => {
      console.error('[useProcessImages] Pre-processing step failed', { error })
      Alert.alert('処理エラー', 'データの読み込みに失敗しました。アプリを再起動してもう一度お試しください。')
    },
  })

  return { ...mutation, progress }
}
```

- [ ] **Step 4: テストがパスすることを確認する**

```bash
bun test src/features/image-processing/model/__tests__/useProcessImages.test.ts --no-coverage
```

Expected: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/features/image-processing/model/useProcessImages.ts \
        src/features/image-processing/model/__tests__/useProcessImages.test.ts
git commit -m "feat: preload persons in useProcessImages and add FaceResult to ImageProcessResult"
```

---

## Task 6: index.ts と app 画面を更新する

**Files:**
- Modify: `src/features/image-processing/index.ts`
- Modify: `app/process/[imageId].tsx`

- [ ] **Step 1: index.ts に新しい型を追加する**

```typescript
// src/features/image-processing/index.ts
export { useProcessImage } from './model/useProcessImage'
export { useProcessImages } from './model/useProcessImages'
export type { ImageProcessResult, ProcessProgress } from './model/useProcessImages'
export type { PersonResult, FaceResult, ProcessImageResult } from './model/processImage'
export { ProcessResultView } from './ui/ProcessResultView'
export { ProcessBatchResultView } from './ui/ProcessBatchResultView'
```

- [ ] **Step 2: app/process/[imageId].tsx を更新する**

`data: resultUri` → `data: result` に変更し、`ProcessResultView` の props を更新する。

```typescript
// app/process/[imageId].tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useProcessImage, ProcessResultView } from '@/features/image-processing'
import { LoadingOverlay } from '@/shared/ui'

export default function ProcessScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>()
  const router = useRouter()
  const uri = decodeURIComponent(imageId ?? '')

  const { mutate: processImage, isPending, data: result, error, reset } = useProcessImage()

  const hasStarted = useRef(false)
  useEffect(() => {
    if (uri && !hasStarted.current) {
      hasStarted.current = true
      processImage(uri)
    }
  }, [uri]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    reset()
    router.back()
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '処理結果', headerBackTitle: '戻る' }} />

      {isPending && <LoadingOverlay message="顔を検出しています..." />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>画像の処理に失敗しました</Text>
          <Text style={styles.errorDetail}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>別の画像を選択</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <ProcessResultView
          originalUri={uri}
          resultUri={result.resultUri}
          faceResults={result.faceResults}
          resizedScale={result.resizedScale}
          onRetry={handleRetry}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: { fontSize: 18, fontWeight: '600', color: '#FF3B30', textAlign: 'center' },
  errorDetail: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 3: 全テストと型チェックを実行する**

```bash
bun run tsc --noEmit && bun test --no-coverage
```

Expected: 型エラーなし・全テスト PASS

- [ ] **Step 4: コミットする**

```bash
git add src/features/image-processing/index.ts app/process/\[imageId\].tsx
git commit -m "feat: wire face score debug overlay into app process screen"
```

---

## GitHub Issue の作成

- [ ] **Step 1: 実装完了後に GitHub Issue を作成する**

```bash
gh issue create \
  --title "feat: 開発ビルドの処理結果プレビューで顔ごとに認識スコアをオーバーレイ表示する" \
  --body "$(cat <<'EOF'
## 概要

開発ビルド（IS_DEV=true）の画像処理結果プレビュー画面で、検出された各顔の上に全登録人物との顔認識スコアと人物名をオーバーレイ表示する。

## 表示仕様

- **一致した顔**（score > threshold）: 赤枠 ＋「人物名 スコア%」ラベル
- **不一致の顔**: 黄枠 ＋「最高スコア%」ラベル（全登録人物の中での最高値）
- 本番ビルドでは一切表示しない

## 実装内容

- \`processImage\` の戻り値を \`ProcessImageResult\`（resultUri + faceResults[] + resizedScale）に拡張
- 新規: \`FaceDebugOverlay\` コンポーネント（純 RN View + Text）
- 新規: \`computeOverlayBox\` 純粋関数（座標変換: 元画像座標 → 画面座標）
- \`useProcessImages\` で persons を事前取得しバッチ処理に渡す
EOF
)"
```

---

## 実装後の動作確認

- [ ] 開発ビルドで画像を選択し処理を実行する
- [ ] 顔が検出された場合にオーバーレイが表示されること
- [ ] 一致した顔に赤枠と人物名＋スコアが表示されること
- [ ] 不一致の顔に黄枠とスコアのみが表示されること
- [ ] 本番ビルドではオーバーレイが表示されないこと（IS_DEV=false）
