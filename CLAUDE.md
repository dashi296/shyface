# shyface — CLAUDE.md

## プロジェクト概要

撮影した写真から、登録済みの特定人物の顔のみを自動で隠すモバイルアプリ。
**完全オンデバイス処理**（サーバ・外部API通信なし）。iOS / Android 両対応。

> 動画対応は現時点では対象外。将来的な追加を想定し、処理パイプラインは静止画に限定して設計する。

実装タスクの順序・詳細は **[TASKS.md](./TASKS.md)** を参照。

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フレームワーク | React Native + Expo (Bare Workflow) |
| 画面遷移 | Expo Router v3（file-based routing） |
| 非同期・キャッシュ管理 | TanStack Query v5 |
| 軽量グローバル状態 | Zustand |
| ローカルDB | expo-sqlite |
| 画像描画 | @shopify/react-native-skia |
| カメラ | react-native-vision-camera |
| iOS 顔検出 | Vision.framework（Swift） |
| iOS 顔認識 | Core ML + FaceNet（.mlmodel） |
| Android 顔検出 | ML Kit Face Detection（オフライン） |
| Android 顔認識 | TensorFlow Lite + FaceNet（.tflite） |
| ビルド | EAS Build |

---

## アーキテクチャ方針

### Feature Sliced Design（FSD）

`src/` 配下を FSD で管理する。`app/` は Expo Router の制約上 FSD 外とし、pages レイヤー相当として扱う。

**採用レイヤー（上位が下位を import する。逆方向禁止）:**

```
app/          ← Expo Router（FSD外・pages相当）
src/features/ ← ビジネスロジック
src/shared/   ← ビジネスロジックなしの共通処理
```

`entities/` `widgets/` レイヤーは現時点では導入しない。必要になった時点で追加する。

### 依存ルール

- `app/` は `features/` と `shared/` を import してよい
- `features/` は `shared/` のみ import してよい
- `shared/` は `features/` を import してはいけない
- 同一レイヤー内のスライス間 import は原則禁止（循環を防ぐ）
- 各スライスの外部公開は `index.ts` 経由のみ

---

## ディレクトリ構成

```
shyface/
├── app/                          # Expo Router（FSD外）
│   ├── _layout.tsx               # QueryClientProvider / RootLayout
│   ├── (tabs)/
│   │   ├── _layout.tsx           # タブナビゲーション定義
│   │   ├── index.tsx             # ホーム（画像選択・撮影起点）
│   │   └── persons/
│   │       └── index.tsx         # 人物一覧
│   └── process/
│       └── [imageId].tsx         # 画像処理・結果プレビュー（動的ルート）
│
├── src/
│   ├── features/                 # ビジネスロジック
│   │   ├── person-registration/  # 人物の顔登録機能
│   │   │   ├── model/
│   │   │   │   └── useRegisterPerson.ts   # useMutation: 撮影→embedding→DB保存
│   │   │   ├── ui/
│   │   │   │   └── RegisterFaceSheet.tsx  # 登録用ボトムシート
│   │   │   └── index.ts                   # public API
│   │   │
│   │   ├── person-management/    # 人物の一覧・削除管理
│   │   │   ├── model/
│   │   │   │   ├── usePersons.ts          # useQuery: 人物一覧取得
│   │   │   │   └── useDeletePerson.ts     # useMutation: 人物削除
│   │   │   ├── ui/
│   │   │   │   └── PersonList.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── image-processing/     # 画像のモザイク処理
│   │       ├── model/
│   │       │   └── useProcessImage.ts     # useMutation: 顔検出→照合→モザイク
│   │       ├── ui/
│   │       │   └── ProcessResultView.tsx  # 処理結果プレビュー
│   │       └── index.ts
│   │
│   └── shared/                   # ビジネスロジックなし共通処理
│       ├── api/
│       │   └── queryClient.ts             # TanStack QueryClient 設定
│       ├── native/               # ネイティブBridgeラッパー（薄いラッパーのみ）
│       │   ├── FaceDetector.ts            # 顔検出 Bridge
│       │   ├── FaceNet.ts                 # embedding抽出 Bridge
│       │   └── Mosaic.ts                  # モザイク処理 Bridge
│       ├── db/                   # SQLite操作（ビジネスロジックなし）
│       │   ├── client.ts                  # DB初期化・マイグレーション
│       │   ├── persons.ts                 # persons テーブル CRUD
│       │   └── embeddings.ts              # embeddings テーブル CRUD
│       ├── ui/                   # 汎用UIコンポーネント
│       │   ├── Button.tsx
│       │   ├── LoadingOverlay.tsx
│       │   └── FaceBox.tsx               # 顔位置のバウンディングボックス表示
│       ├── lib/                  # 純粋関数・ユーティリティ
│       │   ├── cosineSimilarity.ts        # embedding距離計算
│       │   └── imageUtils.ts             # URI変換など
│       └── config/
│           └── constants.ts              # 閾値・モデルパス・定数
│
├── ios/                          # iOS ネイティブコード（Swift）
│   └── FaceBlurApp/
│       ├── FaceDetectorModule.swift
│       ├── FaceNetModule.swift
│       └── MosaicModule.swift
│
└── android/                      # Android ネイティブコード（Kotlin）
    └── app/src/main/java/
        ├── FaceDetectorModule.kt
        ├── FaceNetModule.kt
        └── MosaicModule.kt
```

---

## モデルファイルの配置

FaceNet モデルはプラットフォームごとに分離し、不要なプラットフォームのファイルはビルドに含めない。

```
assets/
└── models/
    ├── ios/
    │   └── facenet.mlmodel       # iOS ビルド時のみ同梱
    └── android/
        └── facenet.tflite        # Android ビルド時のみ同梱
```

- iOS: Xcode ビルドターゲットに `.mlmodel` を追加。Core ML がコンパイル時に `.mlmodelc` へ変換
- Android: `build.gradle` の `sourceSets.main.assets` で `assets/models/android/` のみ指定

---

## shared/native の設計方針

`shared/native/` は薄いラッパーのみ。ビジネスロジック（誰を隠すか、閾値判定など）は持たない。

```typescript
// shared/native/FaceNet.ts の例
import { NativeModules } from 'react-native'
const { FaceNetModule } = NativeModules

export const FaceNet = {
  // embeddingを返すだけ。照合ロジックは features 側で行う
  extractEmbedding: (uri: string): Promise<number[]> =>
    FaceNetModule.extractEmbedding(uri),

  extractAll: (uris: string[]): Promise<number[][]> =>
    FaceNetModule.extractAll(uris),
}
```

---

## TanStack Query の設計方針

### QueryClient 設定

```typescript
// shared/api/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,       // 完全オフライン。外部データソースなし
      gcTime: 1000 * 60 * 60,    // 1時間キャッシュ保持
      retry: 0,                  // ネットワークリトライ不要
    },
  },
})
```

### queryKey 規則

```typescript
['persons']                        // 人物一覧
['persons', personId]              // 特定人物
['embeddings', personId]           // 特定人物のembedding
```

### mutation 後のキャッシュ更新

mutation の `onSuccess` で `invalidateQueries` を呼び、一覧を自動再取得させる。
楽観的更新（optimistic update）は現時点では使わない。

---

## データフロー（画像処理）

```
ユーザーが画像選択
  → app/process/[imageId].tsx
  → features/image-processing の useProcessImage を呼ぶ
      → shared/native/FaceDetector で顔バウンディングボックス取得
      → shared/native/FaceNet で各顔の embedding 抽出
      → shared/db/persons + embeddings から登録済み人物を取得
      → shared/lib/cosineSimilarity で照合
          一致（similarity > THRESHOLD）→ shared/native/Mosaic でモザイク適用
          不一致 → そのまま
      → 処理済み画像 URI を返す
  → features/image-processing の ProcessResultView で表示
```

---

## 定数（shared/config/constants.ts）

```typescript
export const FACE_SIMILARITY_THRESHOLD = 0.7   // 同一人物判定の閾値（0〜1）
export const FACE_REGISTER_MIN_PHOTOS = 3       // 登録に必要な最小枚数

export const MODEL_PATH = {
  ios: 'models/ios/facenet.mlmodel',
  android: 'models/android/facenet.tflite',
} as const
```

---

## コーディング規約

- 言語: TypeScript（strict モード）
- コンポーネント: 関数コンポーネントのみ
- パスエイリアス: `@/` → `src/`（`tsconfig.json` で設定）。アプリに必要なコードは `src/` 配下にすべて配置する
  - 例: `import { FaceNet } from '@/shared/native/FaceNet'` → `src/shared/native/FaceNet.ts` を指す
- `features/` 内のスライスは必ず `index.ts` で public API を定義し、外部からは `index.ts` 経由でのみ import する
- `shared/` 配下の各ディレクトリ（`native/`, `db/`, `ui/`, `lib/`, `config/`）も `index.ts` で public API を定義し、外部からは `index.ts` 経由でのみ import する
- `shared/native/` のラッパー関数はビジネスロジックを持たない。引数・戻り値の型変換のみ行う
- SQLite スキーマ変更はマイグレーションファイルで管理（`shared/db/client.ts`）

### 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネントファイル（`.tsx`） | PascalCase | `RegisterFaceSheet.tsx` |
| hooks ファイル（`.ts`） | camelCase・`use` プレフィックス | `useRegisterPerson.ts` |
| その他 `.ts` ファイル | camelCase | `cosineSimilarity.ts` |
| feature スライスディレクトリ | kebab-case | `person-registration/` |

---

## エラーハンドリング方針

- **ネイティブBridge エラー**: `shared/native/` のラッパーはエラーをそのまま throw する。try/catch は呼び出し元の `features/` 側で行う
- **useMutation**: `onError` コールバックでユーザーへのエラー通知（Toast / Alert）を行う。リトライは行わない
- **useQuery**: `error` 状態を UI に伝播させ、エラーメッセージを表示する。`retry: 0` のためリトライなし
- **DB エラー**: `shared/db/` の関数は throw をそのまま伝播させる。ロールバックが必要なトランザクションは `client.ts` 内で完結させる
- **予期しないエラー**: アプリ全体の Error Boundary（`app/_layout.tsx`）でキャッチし、フォールバック画面を表示する

---

## テスト方針

### テストツール

| 用途 | ツール |
|---|---|
| ユニット・統合テスト | Jest + React Native Testing Library |
| 型チェック | `tsc --noEmit`（CI で必須） |

### テスト対象と優先度

| 対象 | 方針 |
|---|---|
| `shared/lib/`（純粋関数） | **必須**。`cosineSimilarity` など入出力が確定的な関数はすべてテストする |
| `features/` の hooks | **必須**。`renderHook` + SQLite のインメモリ DB でテストする。ネイティブ Bridge はモックする |
| `shared/native/` | **不要**。ネイティブコードのテストはプラットフォーム側（XCTest / JUnit）で行う |
| UI コンポーネント | **任意**。スナップショットより振る舞いテストを優先する |

### モック方針

- `NativeModules`（FaceDetector, FaceNet, Mosaic）は Jest モックで代替する
- `expo-sqlite` は実際の SQLite（インメモリ）を使う。DB 層をモックしない
- 外部ネットワーク通信は存在しないため、ネットワークモックは不要

---

## DB スキーマ

### persons テーブル

```sql
CREATE TABLE persons (
  id         TEXT PRIMARY KEY,  -- UUID
  name       TEXT NOT NULL,
  memo       TEXT,
  created_at TEXT NOT NULL,     -- ISO 8601
  updated_at TEXT NOT NULL
);
```

### embeddings テーブル

```sql
CREATE TABLE embeddings (
  id         TEXT PRIMARY KEY,  -- UUID
  person_id  TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  embedding  TEXT NOT NULL,     -- JSON シリアライズした number[]（128次元）
  source_uri TEXT NOT NULL,     -- 元画像の URI（デバッグ・確認UI用）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 照合方針

- 1人の人物に対して複数の embedding を全件保存する（上限3枚）
- 照合時は登録済み全 embedding と比較し、いずれか1件でも `FACE_SIMILARITY_THRESHOLD` を超えれば一致とみなす

---

## 人物登録フロー

```
1. 名前・メモ入力（RegisterFaceSheet）
2. 写真を3枚 撮影 or フォトライブラリから選択
3. 確認画面（撮影済み写真一覧 + 名前・メモの確認）
4. 確定 → embedding 抽出 → persons / embeddings に保存
   キャンセル → 撮影済み写真を破棄してフロー終了
```

- 途中キャンセル時は撮影済み写真・入力データをすべて破棄する
- 登録枚数は固定3枚（`FACE_REGISTER_MIN_PHOTOS = FACE_REGISTER_MAX_PHOTOS = 3`）

---

## Skia 使用方針

モザイク処理と FaceBox の描画に `@shopify/react-native-skia` を使用する。

- **モザイク処理**（`shared/native/Mosaic.ts`）: 現在は Skia で実装。将来ネイティブモジュールへ移行できるよう、インターフェースはネイティブモジュール想定のシグネチャで定義する

```typescript
// shared/native/Mosaic.ts
export const Mosaic = {
  // 内部実装は Skia。シグネチャはネイティブモジュール移行時も変えない
  apply: (uri: string, regions: BoundingBox[]): Promise<string> => ...
}
```

- **FaceBox**（`shared/ui/FaceBox.tsx`）: 画像上への正確な座標描画のため Skia を使用

---

## Zustand 使用方針

現時点では未使用。将来的な同期 UI 状態管理（登録フローのステップ管理など）に備えて技術スタックに保持する。

---

## 開発環境

### 必要なツール（最新安定版）

- Node.js
- Xcode（iOS 開発）
- Android Studio（Android 開発）
- bun（ローカル開発のパッケージマネージャー）

### 主要コマンド

```bash
bun install           # 依存関係インストール
bunx expo start       # 開発サーバー起動
bunx expo run:ios     # iOS シミュレーターで起動
bunx expo run:android # Android エミュレーターで起動
bun run tsc --noEmit  # 型チェック
bun test              # テスト実行
bun run lint          # oxlint でリント
bun run format:check  # oxfmt でフォーマットチェック
```

### EAS Build

EAS Build サーバーは bun に対応していないため、`eas.json` でパッケージマネージャーを明示する。問題が発生した場合は pnpm にフォールバックする。

---

## プライバシー・セキュリティ方針

- 顔データ（embedding）は端末の SQLite にのみ保存。クラウド同期・外部送信は行わない
- iOS: Keychain で DB 暗号化キーを管理
- Android: EncryptedSharedPreferences で DB 暗号化キーを管理
- ネットワーク通信は一切行わない（`app.json` で `android.usesCleartextTraffic: false`）

---

## 将来の改善候補

- **登録時の撮影ガイダンス UI**: 「正面を向いてください」「次は左を向いてください」のようなステップガイドを表示し、精度の高い embedding を取得できるようにする
- **動画対応**: 処理パイプラインを静止画から動画（フレーム単位処理）に拡張する
- **モザイク処理のネイティブモジュール移行**: Skia 実装をネイティブモジュール（Swift/Kotlin）に差し替え、大きな画像・動画での処理速度を改善する