import { Node, SyntaxKind } from "ts-morph";
import {
  type ArgValue,
  OtherLiteralArgValue,
  ParamRefArgValue,
} from "./argValueClasses";

/**
 * 式がパラメータ（関数の引数）を参照しているかどうかを判定する
 * ネストしたプロパティアクセス（例: props.nested.value）にも対応
 */
export function isParameterReference(expression: Node): boolean {
  if (Node.isIdentifier(expression)) {
    const symbol = expression.getSymbol();
    const declaration = symbol?.getDeclarations()[0];
    if (!declaration) return false;
    const kind = declaration.getKind();
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
function findContainingFunction(node: Node): Node | undefined {
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
function getFunctionName(functionScope: Node): string {
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
function buildParameterPath(expression: Node): string {
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
    return new OtherLiteralArgValue(expression.getText());
  }

  const functionName = getFunctionName(functionScope);
  const path = buildParameterPath(expression);
  const line = expression.getStartLineNumber();

  return new ParamRefArgValue(filePath, functionName, path, line);
}
