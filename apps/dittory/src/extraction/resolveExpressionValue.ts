import { Node, SyntaxKind } from "ts-morph";
import {
  type ArgValue,
  ArgValueType,
  type CallSiteMap,
} from "./callSiteCollector";
import { argValueToKey, resolveParameterValue } from "./parameterUtils";

/**
 * 引数が渡されなかった場合を表す特別な値
 * 必須/任意を問わず、引数未指定の使用箇所を統一的に扱うために使用
 *
 * 注意: この値は文字列 "[undefined]" であり、JavaScriptの undefined とは異なる。
 * 解決関数が undefined を返す場合は「値を解決できなかった」ことを意味し、
 * この文字列を返す場合は「実際に undefined が渡された」ことを意味する。
 */
export const UNDEFINED_VALUE = "[undefined]";

/**
 * 関数型の値を表すプレフィックス
 * コールバック関数など、関数が渡された場合は使用箇所ごとにユニークな値として扱う
 * これにより、同じコールバック関数を渡していても「定数」として検出されない
 */
export const FUNCTION_VALUE_PREFIX = "[function]";

/**
 * resolveExpressionValueのコンテキスト
 */
export interface ResolveContext {
  /** 呼び出し情報（パラメータ参照の解決に使用） */
  callSiteMap: CallSiteMap;
}

/**
 * 式がパラメータ（関数の引数）を参照しているかどうかを判定する
 */
function isParameterReference(expression: Node): boolean {
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
function createParamRefValue(expression: Node): ArgValue {
  const sourceFile = expression.getSourceFile();
  const filePath = sourceFile.getFilePath();
  const functionScope = findContainingFunction(expression);

  if (!functionScope) {
    return { type: ArgValueType.Literal, value: expression.getText() };
  }

  const functionName = getFunctionName(functionScope);
  const path = buildParameterPath(expression);

  return { type: ArgValueType.ParamRef, filePath, functionName, path };
}

/**
 * 式の実際の値を解決する
 *
 * 異なるファイルで同じenum値やリテラル値を使用している場合でも、
 * 同一の値として認識できるよう、値を正規化して文字列表現で返す。
 * 同名だが異なる定義（別ファイルの同名enum等）を区別するため、
 * 必要に応じてファイルパスを含めた識別子を返す。
 *
 * @param expression - 解決対象の式
 * @param context - 呼び出し情報などのコンテキスト
 */
export function resolveExpressionValue(
  expression: Node,
  context: ResolveContext,
): string {
  // 関数型の場合は定数として扱わない。
  // 同じ関数参照でも使用箇所ごとに異なる値として扱うことで、
  // コールバック関数が「常に同じ値」として誤検出されるのを防ぐ
  const type = expression.getType();
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return `${FUNCTION_VALUE_PREFIX}${sourceFile.getFilePath()}:${line}`;
  }

  // PropertyAccessExpression (例: Status.Active, props.number) の場合
  if (Node.isPropertyAccessExpression(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];

    // enum memberの場合は、同名enumの誤認識を防ぐためファイルパスを含める
    if (decl && Node.isEnumMember(decl)) {
      const enumDecl = decl.getParent();
      if (Node.isEnumDeclaration(enumDecl)) {
        const filePath = enumDecl.getSourceFile().getFilePath();
        const enumName = enumDecl.getName();
        const memberName = decl.getName();
        const value = decl.getValue();
        // 例: "/path/to/file.ts:Status.Active=0"
        return `${filePath}:${enumName}.${memberName}=${JSON.stringify(value)}`;
      }
    }

    // 左辺がパラメータを参照している場合（例: props.number）
    if (isParameterReference(expression.getExpression())) {
      // パラメータ参照を作成して解決を試みる
      const paramRef = createParamRefValue(expression);
      const resolved = resolveParameterValue(paramRef, context.callSiteMap);
      if (resolved !== undefined) {
        return argValueToKey(resolved);
      }
      // 解決できない場合は使用箇所ごとにユニークな値として扱う
      return argValueToKey(paramRef);
    }
  }

  // Identifier (変数参照) の場合
  // 変数の定義元を辿って実際の値を解決する
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return UNDEFINED_VALUE;
    }

    const symbol = expression.getSymbol();
    // インポートされた変数の場合、エイリアス先（元のエクスポート）のシンボルを取得する
    // これにより、異なるファイルから同じ変数をインポートした場合でも同一の値として認識される
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    const decl = resolvedSymbol?.getDeclarations()[0];

    if (decl && Node.isVariableDeclaration(decl)) {
      const initializer = decl.getInitializer();
      // 初期化子がある場合は再帰的に値を解決する
      // これにより、変数チェーン（const a = b; const b = 1;）も最終的な値まで辿れる
      // 初期化子がない場合は、ファイルパス + 変数名で一意に識別
      return initializer
        ? resolveExpressionValue(initializer, context)
        : `${decl.getSourceFile().getFilePath()}:${expression.getText()}`;
    }

    // パラメータや分割代入など、VariableDeclaration以外の宣言の場合
    // ファイルパス + 変数名で識別する
    if (decl) {
      return `${decl.getSourceFile().getFilePath()}:${expression.getText()}`;
    }
  }

  // リテラル型の場合は型情報から値を取得
  // JSON.stringifyで文字列と数値を区別できる形式にする（"foo" vs 42）
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return JSON.stringify(type.getLiteralValue());
  }

  // booleanリテラルの場合はgetLiteralValue()がundefinedを返すためgetText()を使用
  if (type.isBooleanLiteral()) {
    return type.getText();
  }

  // 上記のいずれにも該当しない場合（オブジェクト、配列、テンプレートリテラル等）
  // ソースコードのテキストをそのまま返す
  return expression.getText();
}
