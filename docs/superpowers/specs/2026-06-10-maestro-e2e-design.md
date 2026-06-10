# Maestro E2E テスト設計

## 概要

shyface アプリの E2E テストを Maestro で構築する。
Gherkin feature ファイルで定義された仕様のうち、Happy Path シナリオを Maestro YAML フローとして実装する。

---

## 方針

### テスト対象

全シナリオを網羅するのではなく、安定して動作する Happy Path に絞る。

| フロー | 対応する feature ファイル |
|---|---|
| タブナビゲーション | 00_navigation.feature |
| 人物登録 | 02_person_registration.feature |
| 人物管理（一覧・削除） | 03_person_management.feature |
| 画像処理（単枚） | 04_image_processing_single.feature |
| Debug 画面 | 06_debug.feature |

### Gherkin ファイルの扱い

`e2e/features/` の Gherkin ファイルは**人間向けの仕様書として保持する**。
Maestro YAML は `e2e/flows/` に別途作成する。両者は対応関係にあるが、Gherkin は Maestro から直接実行されない。

### 実行方法

手動実行のみ。CI への組み込みは対象外。

```bash
# 全フロー実行
maestro test e2e/flows/

# 個別フロー実行
maestro test e2e/flows/02_person_registration.yaml
```

---

## ディレクトリ構成

```
e2e/
├── features/                        # Gherkin 仕様書（変更なし）
│   ├── 00_navigation.feature
│   ├── 01_home.feature
│   ├── 02_person_registration.feature
│   ├── 03_person_management.feature
│   ├── 04_image_processing_single.feature
│   ├── 05_image_processing_batch.feature
│   └── 06_debug.feature
├── fixtures/                        # テストデータ（変更なし）
│   ├── faces/
│   │   ├── person_a/
│   │   ├── person_b/
│   │   └── recognition/
│   └── embeddings.json
└── flows/                           # Maestro フロー（新規作成）
    ├── subflows/
    │   └── register_person_a.yaml   # person_a を登録する共通操作
    ├── 01_navigation.yaml
    ├── 02_person_registration.yaml
    ├── 03_person_management.yaml
    ├── 04_image_processing.yaml
    └── 05_debug.yaml
```

---

## フロー詳細

### 共通設定

全フローの先頭に以下を記述する：

```yaml
appId: com.dashi296.shyface.dev   # 開発ビルドの Bundle ID
---
```

`initFlow` は使用しない。各フローで必要な事前状態は `runFlow` でサブフローを呼び出して設定する。

### subflows/register_person_a.yaml

人物管理タブを開き、FAB から person_a を登録する操作を共通化したサブフロー。
`e2e/fixtures/faces/person_a/` の画像がシミュレーターのフォトライブラリに注入済みであることを前提とする。

ステップ概要：
1. 人物管理タブをタップ
2. "＋" FAB をタップ → 登録シートが開く
3. 名前フィールドに "Person A" を入力
4. "次へ" をタップ
5. "ライブラリ" をタップ → iOS Photos ピッカーが開く
6. グリッド先頭（最新）から3枚タップしてチェックを付ける（multi-select）
7. "追加" ボタンをタップ → ピッカーが閉じ Step2 に写真3枚が表示される
8. "確認へ" をタップ
9. "登録する" をタップ → シートが閉じる

### 01_navigation.yaml

**対象シナリオ：**
- アプリ起動時にタブバー（ホーム・人物管理）が表示される
- タブ間を切り替えられる

**事前状態：** なし（アプリ起動のみ）

### 02_person_registration.yaml

**対象シナリオ：**
- FAB タップで登録シートが開く
- 名前未入力時は "次へ" が無効
- 名前入力後に "次へ" が有効になる
- Step1 → Step2 → Step3 の遷移
- 写真3枚選択で "確認へ" が有効になる
- 登録完了後に人物一覧に追加される
- キャンセルでシートが閉じる

**事前状態：** 人物管理タブを表示

### 03_person_management.yaml

**対象シナリオ：**
- 未登録時は空状態メッセージが表示される
- 登録済み人物が一覧に表示される
- 削除確認ダイアログが表示される
- 削除を確定すると人物が消える
- 全員削除で空状態メッセージが表示される

**事前状態：** `runFlow: subflows/register_person_a.yaml` で事前登録

### 04_image_processing.yaml

**対象シナリオ：**
- ライブラリから画像を選択すると処理画面に遷移する
- 処理完了後に結果画面が表示される
- "共有する" ボタンが表示される
- "別の画像を選択" でホームに戻る

**事前状態：** `runFlow: subflows/register_person_a.yaml` で事前登録

### 05_debug.yaml

**対象シナリオ：**
- Debug タブが表示される（開発ビルドのみ）
- 閾値・パディングの調整行が表示される
- "＋" で値が増加する
- "−" で値が減少する
- "すべてデフォルトに戻す" でリセットされる

**事前状態：** なし（開発ビルドで起動済み）

---

## 既知の制約と代替手段

| 制約 | 理由 | 代替手段 |
|---|---|---|
| カメラ撮影シナリオは実装しない | iOS Simulator のカメラは制御不能 | フォトライブラリ選択フローで代替 |
| モザイク適用の視覚的検証は行わない | Maestro はピクセル比較非対応 | 処理完了画面・結果 UI の表示確認で代替 |
| フォトライブラリの特定画像指定は困難 | `simctl addmedia` 後の表示順が保証されない | 「直近の写真」を選ぶ UI 操作（スクロール先頭）で対処 |
| カメラ権限拒否・顔未検出などの異常系は対象外 | 再現が困難かつ flaky になりやすい | 単体テスト（Jest）でカバー済み |

---

## 事前セットアップ

フローを実行する前に以下が必要：

```bash
# 1. Maestro CLI のインストール（未導入の場合）
brew install maestro

# 2. フィクスチャのダウンロードとシミュレーターへの注入
bun run e2e:setup

# 3. 開発ビルドをシミュレーターで起動
bun run ios
```

`e2e:setup` は `download-test-fixtures.sh` + `load-fixtures-to-simulator.sh` を実行する。
シミュレーターが起動済みであることが前提。

---

## package.json への追加スクリプト

```json
{
  "e2e:test": "maestro test e2e/flows/",
  "e2e:test:nav": "maestro test e2e/flows/01_navigation.yaml",
  "e2e:test:reg": "maestro test e2e/flows/02_person_registration.yaml",
  "e2e:test:mgmt": "maestro test e2e/flows/03_person_management.yaml",
  "e2e:test:proc": "maestro test e2e/flows/04_image_processing.yaml",
  "e2e:test:debug": "maestro test e2e/flows/05_debug.yaml"
}
```

---

## Gherkin との対応表

Gherkin シナリオと Maestro フローの対応関係。未実装のシナリオは「対象外」と明記する。

| feature ファイル | Maestro 対応フロー | 未実装シナリオ |
|---|---|---|
| 00_navigation.feature | 01_navigation.yaml | なし |
| 01_home.feature | 04_image_processing.yaml | カメラ権限拒否 |
| 02_person_registration.feature | 02_person_registration.yaml | 顔未検出エラー、カメラ権限拒否 |
| 03_person_management.feature | 03_person_management.yaml | なし |
| 04_image_processing_single.feature | 04_image_processing.yaml | カメラ撮影シナリオ全般、モザイク視覚検証 |
| 05_image_processing_batch.feature | 対象外（今回スコープ外） | 全シナリオ |
| 06_debug.feature | 05_debug.yaml | アプリ再起動後の値保持 |
