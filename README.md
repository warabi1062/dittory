# dittory

TypeScript/Reactコードベースを静的解析し、常に同じ値が渡されているpropsや関数引数を検出するCLIツールです。

## 特徴

- **Reactコンポーネント解析**: exportされたReactコンポーネントのprops使用状況を分析
- **関数解析**: exportされた関数の引数使用状況を分析
- **クラスメソッド解析**: exportされたクラスのメソッド引数使用状況を分析
- **定数検出**: 常に同じ値が渡されているprops/引数を特定し、定数化の候補として報告

## インストール

```bash
pnpm add -D dittory
```

## 使い方

```bash
# デフォルト（./src ディレクトリを解析）
npx dittory

# 特定のディレクトリを解析
npx dittory ./path/to/src

# オプション指定
npx dittory --min=3 --target=components ./src
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--min=<number>` | 定数として報告する最小使用箇所数 | 2 |
| `--target=<mode>` | 解析対象 (`all`, `components`, `functions`) | all |
| `--help` | ヘルプを表示 | - |

## 出力例

```
解析対象ディレクトリ: ./src
最小使用箇所数: 2
解析対象: all

=== 常に同じ値が渡されているprops ===

Button (src/components/Button.tsx)
  - variant: "primary" (3箇所)
  - size: "medium" (5箇所)

=== 常に同じ値が渡されている関数引数 ===

fetchData (src/api/client.ts)
  - timeout: 5000 (4箇所)
```

## 開発

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build

# テスト
pnpm test

# 型チェック
pnpm typecheck

# リント
pnpm lint
```

## ライセンス

MIT
