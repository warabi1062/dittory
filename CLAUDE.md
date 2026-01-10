# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 基本事項

会話は常に日本語で行うこと

## コマンド

```bash
pnpm lint       # Biomeによるリント（自動修正あり）
pnpm test       # 全テスト実行
pnpm typecheck  # TypeScript型チェック
pnpm build      # tsdownでビルド
pnpm dev        # ビルド後にCLI実行
```

単一テストファイルの実行:
```bash
pnpm vitest run src/analyzer/componentAnalyzer.test.ts
```

コード修正後は必ず `pnpm lint && pnpm test && pnpm typecheck` を実行してエラーがないことを確認すること。

## ドキュメント

ドキュメントは `/docs` ディレクトリにあり、VitePressで構築されている。

```bash
cd docs
pnpm dev      # 開発サーバー起動
pnpm build    # ビルド
```

主要なドキュメントファイル:
- `docs/guide/cli-options.md` - CLIオプションの説明
- `docs/config/options.md` - 設定オプションのリファレンス
- `docs/guide/getting-started.md` - 導入ガイド

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
classifyDeclarations() - 宣言を react/function/class に事前分類
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
- `ExtractUsages`: JSX要素・関数呼び出しからUsageを抽出
- `resolveExpressionValue`: 式の値を文字列に解決（リテラル、enum、変数参照など）
- `flattenObjectExpression`: オブジェクトリテラルを再帰的にフラット化

### 型定義（`src/types.ts`）

- `ClassifiedDeclaration`: 事前分類された宣言（type, exportName, declaration）
- `Exported`: 分析対象（名前、定義、使用状況）
- `Usage`: 使用箇所（名前、値、ファイル、行番号）
- `Constant`: 定数検出結果（常に同じ値が渡されているパラメータ）
