# TASKS.md — 実装タスク一覧

Claude Code が順番に実装できるよう、依存関係を考慮した実装順序でタスクを管理する。

> **ルール**
> - 上位フェーズが完了してから次フェーズに進む
> - 各タスクは対応する GitHub Issue 番号を持つ
> - タスク完了時はステータスを `[ ]` → `[x]` に更新する

---

## フェーズ 1: プロジェクト初期セットアップ

他のすべての実装の前提となる。最初に完了させる。

- [x] **#1** Expo プロジェクト作成（Bare Workflow）
  - `create-expo-app` で Bare Workflow プロジェクトを作成
  - bun をパッケージマネージャーとして設定
  - `eas.json` を作成し EAS Build のパッケージマネージャーを明示

- [x] **#2** 依存パッケージのインストール・設定
  - `expo-router` v3 / `@tanstack/react-query` v5 / `zustand`
  - `expo-sqlite` / `@shopify/react-native-skia` / `react-native-vision-camera`
  - Jest + React Native Testing Library
  - `tsconfig.json` で `@/` → `src/` パスエイリアスを設定
  - `app.json` で `android.usesCleartextTraffic: false` を設定

---

## フェーズ 2: shared レイヤー（基盤）

features レイヤーが依存するため、features より先に実装する。
フェーズ 2 内のタスクは依存がないため並列実装可能。

- [x] **#3** `shared/db/client.ts` — DB初期化・マイグレーション
  - `expo-sqlite` で DB 接続を初期化
  - `persons` / `embeddings` テーブルのマイグレーションを実装
  - スキーマは CLAUDE.md の「DB スキーマ」セクションに従う

- [x] **#4** `shared/db/persons.ts` / `shared/db/embeddings.ts` — CRUD実装
  - **#3 完了後**に着手する
  - ビジネスロジックを持たない SQL 操作のみ
  - `shared/db/index.ts` で public API を export

- [x] **#10** `shared/lib/cosineSimilarity.ts` — コサイン類似度計算
  - `cosineSimilarity(a: number[], b: number[]): number` を実装
  - ユニットテストを必ず作成する（CLAUDE.md: テスト方針）
  - `shared/lib/index.ts` で export

- [x] **#5** `shared/native/FaceDetector.ts` + iOS ネイティブモジュール
  - `ios/FaceBlurApp/FaceDetectorModule.swift` を実装（Vision.framework）
  - React Native Bridge を設定
  - `shared/native/FaceDetector.ts` に薄いラッパーを実装
  - シグネチャ: `detect(uri: string): Promise<BoundingBox[]>`

- [x] **#6** `shared/native/FaceDetector.ts` + Android ネイティブモジュール
  - `android/.../FaceDetectorModule.kt` を実装（ML Kit Face Detection）
  - iOS と同一インターフェースになっていることを確認

- [x] **#7** `shared/native/FaceNet.ts` + iOS ネイティブモジュール
  - `assets/models/ios/facenet.mlmodel` を配置し Xcode ターゲットに追加
  - `ios/FaceBlurApp/FaceNetModule.swift` を実装（Core ML）
  - シグネチャ: `extractEmbedding(uri: string): Promise<number[]>` / `extractAll(uris: string[]): Promise<number[][]>`

- [x] **#8** `shared/native/FaceNet.ts` + Android ネイティブモジュール
  - `assets/models/android/facenet.tflite` を配置し `build.gradle` に設定
  - `android/.../FaceNetModule.kt` を実装（TensorFlow Lite）
  - iOS と同一インターフェースになっていることを確認

- [x] **#9** `shared/native/Mosaic.ts` — Skia によるモザイク処理
  - `@shopify/react-native-skia` でモザイク処理を実装
  - シグネチャ: `apply(uri: string, regions: BoundingBox[]): Promise<string>`
  - **シグネチャは将来のネイティブ移行時も変更しない**

- [x] **#11** `shared/ui/` — 汎用UIコンポーネント
  - `Button.tsx` / `LoadingOverlay.tsx`
  - `FaceBox.tsx`（Skia を使った顔位置バウンディングボックス）
  - `shared/ui/index.ts` で export

- [x] `shared/api/queryClient.ts` — TanStack QueryClient 設定
  - `staleTime: Infinity` / `gcTime: 1時間` / `retry: 0`
  - `app/_layout.tsx` に `QueryClientProvider` を組み込む

---

## フェーズ 3: features レイヤー

フェーズ 2 完了後に着手する。features 間に依存はないため並列実装可能。

- [x] **#12** `features/person-registration/` — 人物登録機能
  - `useRegisterPerson.ts`（useMutation: 撮影 → embedding 抽出 → DB 保存）
  - `RegisterFaceSheet.tsx`（名前入力 → 3枚撮影/選択 → 確認 → 保存）
  - キャンセル時は撮影済み写真・入力データをすべて破棄
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

- [x] **#13** `features/person-management/` — 人物一覧・削除管理
  - `usePersons.ts`（useQuery）/ `useDeletePerson.ts`（useMutation）
  - `PersonList.tsx`
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

- [x] **#14** `features/image-processing/` — 画像モザイク処理
  - `useProcessImage.ts`（useMutation: 顔検出 → 照合 → モザイク）
  - `ProcessResultView.tsx`（処理結果プレビュー）
  - `index.ts` で public API を export
  - hooks のテストを作成（必須）

---

## フェーズ 4: 画面（app/ レイヤー）

フェーズ 3 完了後に着手する。

- [x] `app/_layout.tsx` — RootLayout / Error Boundary
  - `QueryClientProvider` を組み込む
  - アプリ全体の Error Boundary を設置

- [x] `app/(tabs)/_layout.tsx` — タブナビゲーション定義

- [x] **#15** `app/(tabs)/index.tsx` — ホーム画面
  - フォトライブラリから画像を選択する UI
  - カメラで撮影する UI
  - 選択・撮影後に `app/process/[imageId].tsx` へ遷移

- [x] **#16** `app/(tabs)/persons/index.tsx` — 人物一覧画面
  - `PersonList` を組み込む
  - `RegisterFaceSheet` を呼び出す導線（FAB など）

- [x] **#17** `app/process/[imageId].tsx` — 画像処理・結果プレビュー画面
  - `useProcessImage` を呼び出して処理を実行
  - `ProcessResultView` で結果を表示
  - 処理中は `LoadingOverlay` を表示

---

## フェーズ 5: 顔識別精度向上

初期実装完了後に着手する。依存関係と検証コストを考慮した実施順序で管理する。

- [x] **#27** iOS FaceNetModule: MLMultiArray の入力レイアウト (NHWC vs NCHW) を検証する
  - 実装が Swift/CoreML から react-native-fast-tflite（JS/TFLite）に移行済みのため再検証
  - `facenet.tflite` の入力 shape を flatbuffer パースで確認: `[1, 160, 160, 3]` (NHWC) ✓
  - `FaceNet.ts` の `uriToFloat32Input` も NHWC で正しく実装されており修正不要

- [x] **Dev 画面** 開発ビルド専用 Debug 画面で閾値をリアルタイム調整できるようにする
  - `src/shared/config/devOverrides.ts` — Zustand + expo-file-system 永続化
  - `src/shared/config/runtimeConstants.ts` — getThreshold() / getPadding() アクセサ
  - `app/(tabs)/debug.tsx` — +/- ボタンで閾値・パディングを調整する画面
  - 非開発ビルドでは完全無効化（IS_DEV = false）

- [x] **#49** FaceNet embedding 精度の自動テスト基盤を構築する
  - Python スクリプトで LFW dataset から embedding を生成し JSON に保存
  - Jest で FAR / FRR / 正解率を計測・出力できるテストを作成

- [ ] **#52** 顔マッチング閾値を 0.6 から 0.7 に引き上げる
  - `FACE_SIMILARITY_THRESHOLD = 0.6 → 0.7`（CLAUDE.md との乖離解消）
  - #49 のテスト基盤で定量検証してから入れる
  - コスト: 低 / 効果: 高

- [ ] **#56** 顔クロップのパディングを 0.2 から 0.1 に縮小する
  - `FACE_CROP_PADDING = 0.2 → 0.1`（背景ノイズ低減）
  - #52 と同時期に Dev 画面で検証しながら調整する
  - コスト: 低 / 効果: 小〜中

- [ ] **#54** マッチング戦略を「任意一致」から「Top-K 平均スコア」方式に変更する
  - 登録 embedding の外れ値に強くなる
  - Dev 画面に TOP_K 定数を追加する（issue #54 参照）
  - コスト: 中 / 効果: 中〜高

- [ ] **#53** ML Kit ランドマークを使った顔アライメントを実装する
  - 傾いた顔の認識精度が大幅向上する最大効果の改善
  - 実装コストが高いため #52/#56/#54 の後に着手する
  - コスト: 高 / 効果: 高

- [ ] **#55** 登録時に顔の品質チェック（サイズ・傾き角）を追加する
  - #53 の rollAngle に依存するため最後に実施
  - Dev 画面に品質チェック閾値定数を追加する（issue #55 参照）
  - コスト: 中 / 効果: 中

---

## フェーズ 6: その他の将来の改善候補（Future）

- [ ] **#18** 登録時の撮影ガイダンス UI
- [ ] **#19** 動画対応
- [ ] **#20** Mosaic 処理のネイティブモジュール移行
