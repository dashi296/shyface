# TASKS.md — 実装タスク一覧

Claude Code が順番に実装できるよう、依存関係を考慮した実装順序でタスクを管理する。

> **ルール**
> - 上位フェーズが完了してから次フェーズに進む
> - 各タスクは対応する GitHub Issue 番号を持つ
> - タスク完了時はステータスを `[ ]` → `[x]` に更新する

---

## フェーズ 1: プロジェクト初期セットアップ

他のすべての実装の前提となる。最初に完了させる。

- [ ] **#1** Expo プロジェクト作成（Bare Workflow）
  - `create-expo-app` で Bare Workflow プロジェクトを作成
  - bun をパッケージマネージャーとして設定
  - `eas.json` を作成し EAS Build のパッケージマネージャーを明示

- [ ] **#2** 依存パッケージのインストール・設定
  - `expo-router` v3 / `@tanstack/react-query` v5 / `zustand`
  - `expo-sqlite` / `@shopify/react-native-skia` / `react-native-vision-camera`
  - Jest + React Native Testing Library
  - `tsconfig.json` で `@/` → `src/` パスエイリアスを設定
  - `app.json` で `android.usesCleartextTraffic: false` を設定

---

## フェーズ 2: shared レイヤー（基盤）

features レイヤーが依存するため、features より先に実装する。
フェーズ 2 内のタスクは依存がないため並列実装可能。

- [ ] **#3** `shared/db/client.ts` — DB初期化・マイグレーション
  - `expo-sqlite` で DB 接続を初期化
  - `persons` / `embeddings` テーブルのマイグレーションを実装
  - スキーマは CLAUDE.md の「DB スキーマ」セクションに従う

- [ ] **#4** `shared/db/persons.ts` / `shared/db/embeddings.ts` — CRUD実装
  - **#3 完了後**に着手する
  - ビジネスロジックを持たない SQL 操作のみ
  - `shared/db/index.ts` で public API を export

- [ ] **#10** `shared/lib/cosineSimilarity.ts` — コサイン類似度計算
  - `cosineSimilarity(a: number[], b: number[]): number` を実装
  - ユニットテストを必ず作成する（CLAUDE.md: テスト方針）
  - `shared/lib/index.ts` で export

- [ ] **#5** `shared/native/FaceDetector.ts` + iOS ネイティブモジュール
  - `ios/FaceBlurApp/FaceDetectorModule.swift` を実装（Vision.framework）
  - React Native Bridge を設定
  - `shared/native/FaceDetector.ts` に薄いラッパーを実装
  - シグネチャ: `detect(uri: string): Promise<BoundingBox[]>`

- [ ] **#6** `shared/native/FaceDetector.ts` + Android ネイティブモジュール
  - `android/.../FaceDetectorModule.kt` を実装（ML Kit Face Detection）
  - iOS と同一インターフェースになっていることを確認

- [ ] **#7** `shared/native/FaceNet.ts` + iOS ネイティブモジュール
  - `assets/models/ios/facenet.mlmodel` を配置し Xcode ターゲットに追加
  - `ios/FaceBlurApp/FaceNetModule.swift` を実装（Core ML）
  - シグネチャ: `extractEmbedding(uri: string): Promise<number[]>` / `extractAll(uris: string[]): Promise<number[][]>`

- [ ] **#8** `shared/native/FaceNet.ts` + Android ネイティブモジュール
  - `assets/models/android/facenet.tflite` を配置し `build.gradle` に設定
  - `android/.../FaceNetModule.kt` を実装（TensorFlow Lite）
  - iOS と同一インターフェースになっていることを確認

- [ ] **#9** `shared/native/Mosaic.ts` — Skia によるモザイク処理
  - `@shopify/react-native-skia` でモザイク処理を実装
  - シグネチャ: `apply(uri: string, regions: BoundingBox[]): Promise<string>`
  - **シグネチャは将来のネイティブ移行時も変更しない**

- [ ] **#11** `shared/ui/` — 汎用UIコンポーネント
  - `Button.tsx` / `LoadingOverlay.tsx`
  - `FaceBox.tsx`（Skia を使った顔位置バウンディングボックス）
  - `shared/ui/index.ts` で export

- [ ] `shared/api/queryClient.ts` — TanStack QueryClient 設定
  - `staleTime: Infinity` / `gcTime: 1時間` / `retry: 0`
  - `app/_layout.tsx` に `QueryClientProvider` を組み込む

---

## フェーズ 3: features レイヤー

フェーズ 2 完了後に着手する。features 間に依存はないため並列実装可能。

- [ ] **#12** `features/person-registration/` — 人物登録機能
  - `useRegisterPerson.ts`（useMutation: 撮影 → embedding 抽出 → DB 保存）
  - `RegisterFaceSheet.tsx`（名前入力 → 3枚撮影/選択 → 確認 → 保存）
  - キャンセル時は撮影済み写真・入力データをすべて破棄
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

- [ ] **#13** `features/person-management/` — 人物一覧・削除管理
  - `usePersons.ts`（useQuery）/ `useDeletePerson.ts`（useMutation）
  - `PersonList.tsx`
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

- [ ] **#14** `features/image-processing/` — 画像モザイク処理
  - `useProcessImage.ts`（useMutation: 顔検出 → 照合 → モザイク）
  - `ProcessResultView.tsx`（処理結果プレビュー）
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

---

## フェーズ 4: 画面（app/ レイヤー）

フェーズ 3 完了後に着手する。

- [ ] `app/_layout.tsx` — RootLayout / Error Boundary
  - `QueryClientProvider` を組み込む
  - アプリ全体の Error Boundary を設置

- [ ] `app/(tabs)/_layout.tsx` — タブナビゲーション定義

- [ ] **#15** `app/(tabs)/index.tsx` — ホーム画面
  - フォトライブラリから画像を選択する UI
  - カメラで撮影する UI
  - 選択・撮影後に `app/process/[imageId].tsx` へ遷移

- [ ] **#16** `app/(tabs)/persons/index.tsx` — 人物一覧画面
  - `PersonList` を組み込む
  - `RegisterFaceSheet` を呼び出す導線（FAB など）

- [ ] **#17** `app/process/[imageId].tsx` — 画像処理・結果プレビュー画面
  - `useProcessImage` を呼び出して処理を実行
  - `ProcessResultView` で結果を表示
  - 処理中は `LoadingOverlay` を表示

---

## フェーズ 5: 将来の改善候補（Future）

初期実装完了後に着手する。

- [ ] **#18** 登録時の撮影ガイダンス UI
- [ ] **#19** 動画対応
- [ ] **#20** Mosaic 処理のネイティブモジュール移行
