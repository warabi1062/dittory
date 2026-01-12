# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 基本事項

会話は常に日本語で行うこと

## コマンド

本体のソースコードは `apps/dittory/` にあり、コマンドはそのディレクトリで実行する。

```bash
cd apps/dittory

pnpm lint       # Biomeによるリント（自動修正あり）
pnpm test       # 全テスト実行
pnpm typecheck  # TypeScript型チェック
pnpm build      # tsdownでビルド
pnpm dev        # ビルド後にCLI実行
pnpm knip       # 未使用コード検出（production mode）
```

単一テストファイルの実行:
```bash
pnpm vitest run src/analyzer/componentAnalyzer.test.ts
```

コード修正後は必ず `pnpm lint && pnpm test && pnpm typecheck` を実行してエラーがないことを確認すること。

## ドキュメント

ドキュメントはルートの `/docs` ディレクトリにあり、VitePressで構築されている。

```bash
# ルートから実行
pnpm docs:build     # ドキュメントビルド
pnpm docs:preview   # プレビュー
```

主要なドキュメントファイル:
- `docs/guide/getting-started.md` - 導入ガイド
- `docs/guide/cli-options.md` - CLIオプションの説明
- `docs/guide/config.md` - 設定ファイルの説明
- `docs/guide/config-options.md` - 設定オプションのリファレンス
- `docs/guide/what-is-dittory.md` - ツールの概要
- `docs/guide/limitations.md` - 制限事項

CLIオプションや設定を変更した場合は、対応するドキュメントも更新すること。

## コーディング規約

### Linting
- Biomeの設定に従う
- `biome-ignore`コメントでのエラー回避は原則禁止

### TypeScript
- `as any`での型エラー解消は原則禁止
- `as`による型アサーションは原則禁止。型ガードやユーザー定義型ガードで型を絞り込む
- 互換性のための再エクスポート（re-export）は禁止。インポート元を変更する場合は、すべての利用箇所を直接更新する

### ファイル命名
- camelCaseで記述（例: `analyzeProps.ts`, `isReactComponent.ts`）

### Testing
- 3A方式（Arrange, Act, Assert）でテストを記述
- テスト名（describe、it）は日本語で記述
- 存在チェックには `toBeDefined` ではなく `if (!x) { expect.unreachable() }` を使用する

### コメント
- コメントは過不足なく書く
- 人間にとって理解しにくい処理には説明を書く
- 実装が単純だとしても、なぜその実装なのか、意図や背景が解りにくい部分にはコメントを書く

## アーキテクチャ

### 処理フロー

```
CLI (cli.ts)
  ↓
createFilteredSourceFiles() - ts-morphでソースファイルを読み込み
  ↓
CallSiteCollector.collect() - 呼び出し情報を事前収集
  ↓
┌─────────────────────────────────────────────────────┐
│ analyzePropsCore()         analyzeFunctionsCore()  │
│        ↓                          ↓                │
│ ComponentAnalyzer         FunctionAnalyzer         │
│                           ClassMethodAnalyzer      │
└─────────────────────────────────────────────────────┘
  ↓
printAnalysisResult() - 結果を出力
```

### 主要コンポーネント

**Analyzer（`src/analyzer/`）**
- `BaseAnalyzer`: 抽象基底クラス。`analyze()`で収集→グループ化→定数抽出の流れを実装
- `ComponentAnalyzer`: Reactコンポーネントのprops使用状況を分析
- `FunctionAnalyzer`: 通常関数の引数使用状況を分析
- `ClassMethodAnalyzer`: クラスメソッドの引数使用状況を分析

**宣言分類（`src/source/classifyDeclarations.ts`）**
- exportされた宣言を`DeclarationType`（"react" | "function" | "class"）に分類
- Reactコンポーネント判定は`isReactComponent()`で行う

**使用状況抽出（`src/extraction/`）**
- `extractUsages.ts`: JSX要素・関数呼び出しからUsageを抽出
- `ExpressionResolver`: 式の値をArgValueに解決（リテラル、enum、変数参照など）
- `CallSiteCollector`: 関数呼び出しの引数情報を事前収集し、パラメータ参照を解決可能にする
- `extractArgValue.ts`: 式からArgValueを抽出

### ドメインモデル（`src/domain/`）

- `ClassifiedDeclaration`: 事前分類された宣言（type, exportName, declaration）
- `AnalyzedDeclarations`: 分析対象のコレクション（名前、定義、使用状況）
- `Usage`: 使用箇所（名前、値、ファイル、行番号）
- `ArgValue`: 引数の値を表すバリューオブジェクト群（リテラル、enum参照、パラメータ参照など）
- `ConstantParams`: 定数検出結果のコレクション
- `CallSiteMap`: 呼び出し情報のマップ（パラメータ参照の解決に使用）
