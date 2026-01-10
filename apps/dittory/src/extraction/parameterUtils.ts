import { Node, SyntaxKind } from "ts-morph";
import {
  type ArgValue,
  ArgValueType,
  type CallSiteMap,
  LiteralKind,
} from "./callSiteCollector";

/**
 * 式がパラメータ（関数の引数）を参照しているかどうかを判定する
 * ネストしたプロパティアクセス（例: props.nested.value）にも対応
 */
export function isParameterReference(expression: Node): boolean {
  if (Node.isIdentifier(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];
    if (!decl) return false;
    const kind = decl.getKind();
    return kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement;
  }
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
 * パラメータ参照の ArgValue を作成する
 */
export function createParamRefValue(expression: Node): ArgValue {
  const sourceFile = expression.getSourceFile();
  const filePath = sourceFile.getFilePath();
  const functionScope = findContainingFunction(expression);

  if (!functionScope) {
    return {
      type: ArgValueType.Literal,
      value: expression.getText(),
      literalKind: LiteralKind.Other,
    };
  }

  const functionName = getFunctionName(functionScope);
  const path = buildParameterPath(expression);

  return { type: ArgValueType.ParamRef, filePath, functionName, path };
}

/**
 * ArgValue を比較可能な文字列キーに変換
 * 同じ値かどうかの判定に使用
 */
export function argValueToKey(value: ArgValue): string {
  switch (value.type) {
    case ArgValueType.Literal:
      return `literal:${value.value}`;
    case ArgValueType.Function:
      return `function:${value.filePath}:${value.line}`;
    case ArgValueType.ParamRef:
      return `paramRef:${value.filePath}:${value.functionName}:${value.path}`;
    case ArgValueType.Undefined:
      return "undefined";
  }
}

/**
 * パラメータ参照を解決する
 * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
 * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
 *
 * @param argValue - 解決対象の ArgValue
 * @param callSiteMap - 呼び出し情報マップ
 * @param visited - 循環参照防止用のセット
 * @returns 解決された ArgValue。異なる値がある場合や解決できない場合はundefined
 */
export function resolveParameterValue(
  argValue: ArgValue,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
): ArgValue | undefined {
  // パラメータ参照でない場合はそのまま返す
  if (argValue.type !== ArgValueType.ParamRef) {
    return argValue;
  }

  // 循環参照を防ぐ
  const key = argValueToKey(argValue);
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);

  const { filePath, functionName, path } = argValue;
  const targetId = `${filePath}:${functionName}`;
  const callSiteInfo = callSiteMap.get(targetId);

  if (!callSiteInfo) {
    return undefined;
  }

  // パラメータパスからプロパティ名を抽出
  // 例: "props.number" → "number", "a" → "a"
  const paramParts = path.split(".");
  // JSXの場合は props.xxx 形式なので最後のプロパティ名を使用
  // 通常関数の場合は最初の名前がそのまま引数名
  const propName =
    paramParts.length > 1 ? paramParts[paramParts.length - 1] : paramParts[0];

  const args = callSiteInfo.get(propName);
  if (!args || args.length === 0) {
    return undefined;
  }

  // すべての呼び出し箇所で渡された値を収集
  const resolvedKeys = new Set<string>();
  let resolvedValue: ArgValue | undefined;

  for (const arg of args) {
    // 再帰的にパラメータ参照を解決
    const resolved = resolveParameterValue(
      arg.value,
      callSiteMap,
      new Set(visited),
    );
    if (resolved === undefined) {
      return undefined;
    }

    const resolvedKey = argValueToKey(resolved);
    resolvedKeys.add(resolvedKey);
    resolvedValue = resolved;
  }

  // すべて同じ値なら、その値を返す
  if (resolvedKeys.size === 1) {
    return resolvedValue;
  }

  // 異なる値がある場合は解決不可
  return undefined;
}
