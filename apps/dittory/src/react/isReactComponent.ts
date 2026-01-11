import { Node } from "ts-morph";

/**
 * 宣言がReactコンポーネントかどうかを判定する
 * - 関数がJSXを返しているかチェック
 * - React.FC型注釈を持っているかチェック
 */
export function isReactComponent(declaration: Node): boolean {
  // 関数宣言の場合
  if (Node.isFunctionDeclaration(declaration)) {
    return containsJsx(declaration);
  }

  // 変数宣言の場合 (const Button = ...)
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer) return false;

    // アロー関数または関数式の場合
    if (
      Node.isArrowFunction(initializer) ||
      Node.isFunctionExpression(initializer)
    ) {
      return containsJsx(initializer);
    }

    // React.forwardRef, React.memo などのラッパー関数の場合
    if (Node.isCallExpression(initializer)) {
      const args = initializer.getArguments();
      for (const arg of args) {
        if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
          if (containsJsx(arg)) return true;
        }
      }
    }
  }

  return false;
}

/**
 * ノード内にJSX要素が含まれているかチェック
 * 効率化: 1回のトラバースで全てのJSX要素をチェック
 */
function containsJsx(node: Node): boolean {
  let hasJsx = false;

  node.forEachDescendant((descendant) => {
    if (
      Node.isJsxElement(descendant) ||
      Node.isJsxSelfClosingElement(descendant) ||
      Node.isJsxFragment(descendant)
    ) {
      hasJsx = true;
      return true; // 早期終了
    }
    return undefined;
  });

  return hasJsx;
}
