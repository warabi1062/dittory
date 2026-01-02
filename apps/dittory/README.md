# dittory

Reactコンポーネントや関数の引数使用状況を静的解析し、**常に同じ値が渡されているパラメータ**を検出するCLIツールです。

## 用途

- 不要なパラメータの発見（デフォルト値化の候補）
- コードベースのリファクタリング支援
- APIの簡素化

## インストール

```bash
npm install -g dittory
```

## 使い方

```bash
# srcディレクトリを解析（デフォルト）
dittory

# 特定のディレクトリを解析
dittory ./path/to/src

# 最小使用回数を指定（デフォルト: 2）
dittory --min=3

# 解析対象を指定
dittory --target=components  # Reactコンポーネントのみ
dittory --target=functions   # 関数・クラスメソッドのみ
dittory --target=all         # 両方（デフォルト）

# ヘルプ
dittory --help
```

## 出力例

```
解析対象ディレクトリ: ./src
最小使用箇所数: 2
解析対象: all

1. exportされたコンポーネントを収集中...
   → 15個のコンポーネントを検出

=== 常に同じ値が渡されているprops ===

コンポーネント: Button
  定義: src/components/Button.tsx
  prop: variant
  常に渡される値: "primary"
  使用箇所: 5箇所
    - src/pages/Home.tsx:23
    - src/pages/About.tsx:45
    ...
```

## 検出対象

- **Reactコンポーネント**: JSX要素として使用されているコンポーネントのprops
- **関数**: exportされた関数の引数
- **クラスメソッド**: exportされたクラスのメソッド引数

## 要件

- Node.js >= 18
- プロジェクトに `tsconfig.json` が必要

## ライセンス

MIT
