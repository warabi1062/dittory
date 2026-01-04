import { Node, SyntaxKind } from "ts-morph";
import type { CallSiteMap } from "./callSiteCollector";

/**
 * パラメータ参照を表すプレフィックス
 * 形式: "[param]ファイルパス:関数名:パラメータパス"
 */
export const PARAM_REF_PREFIX = "[param]";

/**
 * 式がパラメータ（関数の引数）を参照しているかどうかを判定する
 * ネストしたプロパティアクセス（例: props.nested.value）にも対応
 */
export function isParameterReference(expression: Node): boolean {
  if (Node.isIdentifier(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];
    if (!decl) return false;
    // Parameter（通常の引数）またはBindingElement（分割代入パターン）の場合
    const kind = decl.getKind();
    return kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement;
  }
  // ネストしたPropertyAccessExpression（例: props.nested.value）の場合は再帰的にチェック
  if (Node.isPropertyAccessExpression(expression)) {
    return isParameterReference(expression.getExpression());
  }
  return false;
}

/**
 * 式を含む関数宣言を見つける
 */
export function findContainingFunction(node: Node): Node | undefined {
  let current: Node | undefined = node;
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isArrowFunction(current) ||
      Node.isFunctionExpression(current) ||
      Node.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.getParent();
  }
  return undefined;
}

/**
 * 関数スコープから関数名を取得する
 */
export function getFunctionName(functionScope: Node): string {
  if (Node.isFunctionDeclaration(functionScope)) {
    return functionScope.getName() ?? "anonymous";
  }

  if (
    Node.isArrowFunction(functionScope) ||
    Node.isFunctionExpression(functionScope)
  ) {
    const parent = functionScope.getParent();
    if (parent && Node.isVariableDeclaration(parent)) {
      return parent.getName();
    }
    return "anonymous";
  }

  if (Node.isMethodDeclaration(functionScope)) {
    const className = functionScope
      .getParent()
      ?.asKind(SyntaxKind.ClassDeclaration)
      ?.getName();
    const methodName = functionScope.getName();
    return className ? `${className}.${methodName}` : methodName;
  }

  return "anonymous";
}

/**
 * 式からパラメータパスを構築
 * 例: props.nested.value → "props.nested.value"
 */
export function buildParameterPath(expression: Node): string {
  if (Node.isIdentifier(expression)) {
    return expression.getText();
  }
  if (Node.isPropertyAccessExpression(expression)) {
    const left = buildParameterPath(expression.getExpression());
    const right = expression.getName();
    return `${left}.${right}`;
  }
  return expression.getText();
}

/**
 * パラメータ参照の識別子を作成
 * 形式: "[param]ファイルパス:関数名:パラメータパス"
 */
export function createParameterRef(expression: Node): string {
  const sourceFile = expression.getSourceFile();
  const filePath = sourceFile.getFilePath();

  const functionScope = findContainingFunction(expression);
  if (!functionScope) {
    // フォールバック: ファイルパス+行番号
    const line = expression.getStartLineNumber();
    return `${PARAM_REF_PREFIX}${filePath}:${line}`;
  }

  const functionName = getFunctionName(functionScope);
  const parameterPath = buildParameterPath(expression);

  return `${PARAM_REF_PREFIX}${filePath}:${functionName}:${parameterPath}`;
}

/**
 * パラメータ参照文字列をパースする
 */
export function parseParameterRef(paramRef: string): {
  filePath: string;
  functionName: string;
  parameterPath: string;
} | null {
  if (!paramRef.startsWith(PARAM_REF_PREFIX)) {
    return null;
  }

  const content = paramRef.substring(PARAM_REF_PREFIX.length);
  const parts = content.split(":");

  if (parts.length < 3) {
    return null;
  }

  // ファイルパスに:が含まれる可能性があるため、最後の2つを関数名とパラメータパス、残りをファイルパスとする
  const parameterPath = parts[parts.length - 1];
  const functionName = parts[parts.length - 2];
  const filePath = parts.slice(0, -2).join(":");

  return { filePath, functionName, parameterPath };
}

/**
 * パラメータ参照を解決する
 * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
 * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
 *
 * @param paramRef - パラメータ参照文字列（[param]形式）またはリテラル値
 * @param callSiteMap - 呼び出し情報マップ
 * @param visited - 循環参照防止用のセット
 * @returns 解決された値。異なる値がある場合や解決できない場合はundefined
 */
export function resolveParameterValue(
  paramRef: string,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
): string | undefined {
  // パラメータ参照でない場合はそのまま返す
  if (!paramRef.startsWith(PARAM_REF_PREFIX)) {
    return paramRef;
  }

  // 循環参照を防ぐ
  if (visited.has(paramRef)) {
    return undefined;
  }
  visited.add(paramRef);

  const parsed = parseParameterRef(paramRef);
  if (!parsed) {
    return undefined;
  }

  const { filePath, functionName, parameterPath } = parsed;
  const targetId = `${filePath}:${functionName}`;
  const callSiteInfo = callSiteMap.get(targetId);

  if (!callSiteInfo) {
    return undefined;
  }

  // パラメータパスからプロパティ名を抽出
  // 例: "props.number" → "number", "a" → "a"
  const paramParts = parameterPath.split(".");
  // JSXの場合は props.xxx 形式なので最後のプロパティ名を使用
  // 通常関数の場合は最初の名前がそのまま引数名
  const propName =
    paramParts.length > 1 ? paramParts[paramParts.length - 1] : paramParts[0];

  const args = callSiteInfo.get(propName);
  if (!args || args.length === 0) {
    return undefined;
  }

  // すべての呼び出し箇所で渡された値を収集
  const resolvedValues = new Set<string>();

  for (const arg of args) {
    let value = arg.value;

    // 再帰的にパラメータ参照を解決
    if (value.startsWith(PARAM_REF_PREFIX)) {
      const resolved = resolveParameterValue(
        value,
        callSiteMap,
        new Set(visited),
      );
      if (resolved === undefined) {
        return undefined;
      }
      value = resolved;
    }
    resolvedValues.add(value);
  }

  // すべて同じ値なら、その値を返す
  if (resolvedValues.size === 1) {
    return [...resolvedValues][0];
  }

  // 異なる値がある場合は解決不可
  return undefined;
}
