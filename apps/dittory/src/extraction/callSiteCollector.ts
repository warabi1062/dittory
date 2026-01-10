import {
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type { FileFilter } from "@/types";
import { createParamRefValue, isParameterReference } from "./parameterUtils";

// ============================================================================
// ArgValue クラス階層
// ============================================================================

/**
 * 引数の値を表す基底抽象クラス
 */
export abstract class ArgValue {
  /**
   * 比較用の文字列値を取得する
   */
  abstract getValue(): string;
}

/**
 * リテラル値の基底抽象クラス
 */
export abstract class LiteralArgValue extends ArgValue {}

/**
 * enum メンバーのリテラル値
 */
export class EnumLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly enumName: string,
    readonly memberName: string,
    readonly enumValue: string | number | undefined,
  ) {
    super();
  }

  getValue(): string {
    return `${this.filePath}:${this.enumName}.${this.memberName}=${JSON.stringify(this.enumValue)}`;
  }
}

/**
 * this プロパティアクセスのリテラル値
 */
export class ThisLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
    readonly expression: string,
  ) {
    super();
  }

  getValue(): string {
    return `[this]${this.filePath}:${this.line}:${this.expression}`;
  }
}

/**
 * メソッド呼び出しのリテラル値
 */
export class MethodCallLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
    readonly expression: string,
  ) {
    super();
  }

  getValue(): string {
    return `[methodCall]${this.filePath}:${this.line}:${this.expression}`;
  }
}

/**
 * 変数参照のリテラル値
 */
export class VariableLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly identifier: string,
  ) {
    super();
  }

  getValue(): string {
    return `${this.filePath}:${this.identifier}`;
  }
}

/**
 * boolean リテラル値
 */
export class BooleanLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: boolean) {
    super();
  }

  getValue(): string {
    return String(this.value);
  }
}

/**
 * 文字列リテラル値
 */
export class StringLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: string) {
    super();
  }

  getValue(): string {
    return JSON.stringify(this.value);
  }
}

/**
 * 数値リテラル値
 */
export class NumberLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: number) {
    super();
  }

  getValue(): string {
    return JSON.stringify(this.value);
  }
}

/**
 * JSX boolean shorthand のリテラル値
 */
export class JsxShorthandLiteralArgValue extends LiteralArgValue {
  getValue(): string {
    return "true";
  }
}

/**
 * その他のリテラル値（フォールバック）
 */
export class OtherLiteralArgValue extends LiteralArgValue {
  constructor(readonly expression: string) {
    super();
  }

  getValue(): string {
    return this.expression;
  }
}

/**
 * 関数型の値
 */
export class FunctionArgValue extends ArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
  ) {
    super();
  }

  getValue(): string {
    return `[function]${this.filePath}:${this.line}`;
  }
}

/**
 * パラメータ参照の値
 */
export class ParamRefArgValue extends ArgValue {
  constructor(
    readonly filePath: string,
    readonly functionName: string,
    readonly path: string,
    readonly line: number,
  ) {
    super();
  }

  /**
   * パラメータ参照を解決して文字列表現を返す
   * callSiteMapを使ってパラメータに渡されたすべての値を取得し、
   * すべて同じ値ならその値を返す。解決できない場合は使用箇所ごとにユニークな値を返す。
   */
  resolve(callSiteMap: CallSiteMap): string {
    const resolved = resolveParameterValueInternal(this, callSiteMap);
    if (resolved !== undefined) {
      return argValueToKey(resolved);
    }
    // 解決できない場合は使用箇所ごとにユニークな値として扱う
    return `[paramRef]${this.filePath}:${this.line}:${this.getValue()}`;
  }

  getValue(): string {
    return `paramRef:${this.filePath}:${this.functionName}:${this.path}`;
  }
}

/**
 * undefined の値
 */
export class UndefinedArgValue extends ArgValue {
  getValue(): string {
    return "[undefined]";
  }
}

/**
 * ArgValue を比較可能な文字列キーに変換
 * 同じ値かどうかの判定に使用
 */
export function argValueToKey(value: ArgValue): string {
  // リテラル値は literal: プレフィックスを付けて区別する
  if (value instanceof LiteralArgValue) {
    return `literal:${value.getValue()}`;
  }
  return value.getValue();
}

/**
 * パラメータ参照を解決する（内部関数）
 * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
 * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
 */
function resolveParameterValueInternal(
  paramRef: ParamRefArgValue,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
): ArgValue | undefined {
  // 循環参照を防ぐ
  const key = argValueToKey(paramRef);
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);

  const { filePath, functionName, path } = paramRef;
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
    let resolved: ArgValue | undefined;
    if (arg.value instanceof ParamRefArgValue) {
      resolved = resolveParameterValueInternal(
        arg.value,
        callSiteMap,
        new Set(visited),
      );
    } else {
      resolved = arg.value;
    }

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

/**
 * 呼び出し箇所での引数情報
 */
export interface CallSiteArg {
  /** 引数のインデックス（0始まり）またはプロパティ名 */
  name: string;
  /** 引数の値 */
  value: ArgValue;
  /** 呼び出し元ファイルパス */
  filePath: string;
  /** 呼び出し元行番号 */
  line: number;
}

/**
 * 関数/コンポーネントへの呼び出し情報
 * key: パラメータ名, value: 渡された値の配列
 */
export type CallSiteInfo = Map<string, CallSiteArg[]>;

/**
 * すべての関数/コンポーネントの呼び出し情報
 * key: "ファイルパス:関数名" 形式の識別子
 */
export type CallSiteMap = Map<string, CallSiteInfo>;

/**
 * 関数/コンポーネントの識別子を生成する
 */
export function createTargetId(filePath: string, name: string): string {
  return `${filePath}:${name}`;
}

/**
 * 識別子から関数/コンポーネント名を抽出する
 */
export function parseTargetId(targetId: string): {
  filePath: string;
  name: string;
} {
  const lastColonIndex = targetId.lastIndexOf(":");
  return {
    filePath: targetId.substring(0, lastColonIndex),
    name: targetId.substring(lastColonIndex + 1),
  };
}

/**
 * 式がthisキーワードへのプロパティアクセスかどうかを判定する
 * ネストしたアクセス（例: this.logger.name）にも対応
 */
function isThisPropertyAccess(expression: Node): boolean {
  if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    if (baseExpr.getKind() === SyntaxKind.ThisKeyword) {
      return true;
    }
    return isThisPropertyAccess(baseExpr);
  }
  return false;
}

/**
 * 式から ArgValue を抽出する
 *
 * 式の値を型安全な ArgValue として返す。
 * 呼び出し情報収集時および式の値解決時に使用する。
 *
 * @param expression - 解析対象の式ノード
 * @returns 式の値を表す ArgValue
 */
export function extractArgValue(expression: Node): ArgValue {
  const type = expression.getType();

  // 関数型の場合
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return new FunctionArgValue(sourceFile.getFilePath(), line);
  }

  // PropertyAccessExpression (例: Status.Active, props.number)
  if (Node.isPropertyAccessExpression(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];

    // enum memberの場合
    if (decl && Node.isEnumMember(decl)) {
      const enumDecl = decl.getParent();
      if (Node.isEnumDeclaration(enumDecl)) {
        return new EnumLiteralArgValue(
          enumDecl.getSourceFile().getFilePath(),
          enumDecl.getName(),
          decl.getName(),
          decl.getValue(),
        );
      }
    }

    // パラメータのプロパティアクセスの場合
    if (isParameterReference(expression.getExpression())) {
      return createParamRefValue(expression);
    }

    // thisキーワードへのプロパティアクセスの場合
    // クラスメンバーは実行時にインスタンスごとに異なる値を持つ可能性があるため、
    // 使用箇所ごとにユニークな値として扱う
    if (isThisPropertyAccess(expression)) {
      return new ThisLiteralArgValue(
        expression.getSourceFile().getFilePath(),
        expression.getStartLineNumber(),
        expression.getText(),
      );
    }
  }

  // Identifier (変数参照)
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return new UndefinedArgValue();
    }

    const symbol = expression.getSymbol();
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    const decl = resolvedSymbol?.getDeclarations()[0];

    if (decl) {
      const kind = decl.getKind();
      // パラメータまたはBindingElementの場合
      if (kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement) {
        return createParamRefValue(expression);
      }

      // 変数宣言の場合は初期化子を再帰的に解決
      if (Node.isVariableDeclaration(decl)) {
        const initializer = decl.getInitializer();
        if (initializer) {
          return extractArgValue(initializer);
        }
        return new VariableLiteralArgValue(
          decl.getSourceFile().getFilePath(),
          expression.getText(),
        );
      }

      // その他の宣言タイプ（インポート宣言など）
      // ファイルパス + 変数名で識別する
      return new VariableLiteralArgValue(
        decl.getSourceFile().getFilePath(),
        expression.getText(),
      );
    }
  }

  // リテラル型
  const literalValue = type.getLiteralValue();
  if (type.isStringLiteral() && typeof literalValue === "string") {
    return new StringLiteralArgValue(literalValue);
  }

  if (type.isNumberLiteral() && typeof literalValue === "number") {
    return new NumberLiteralArgValue(literalValue);
  }

  if (type.isBooleanLiteral()) {
    return new BooleanLiteralArgValue(type.getText() === "true");
  }

  // CallExpression (例: this.method(), obj.method())
  // プロパティアクセスを伴うメソッド呼び出しは、実行時に異なる値を返す可能性があるため、
  // 使用箇所ごとにユニークな値として扱う
  // 例: declSourceFile.getFilePath() はループ内で異なる declSourceFile に対して呼ばれる可能性がある
  if (Node.isCallExpression(expression)) {
    const calleeExpr = expression.getExpression();
    if (Node.isPropertyAccessExpression(calleeExpr)) {
      return new MethodCallLiteralArgValue(
        expression.getSourceFile().getFilePath(),
        expression.getStartLineNumber(),
        expression.getText(),
      );
    }
  }

  return new OtherLiteralArgValue(expression.getText());
}

/**
 * JSX要素から呼び出し情報を抽出
 */
function extractFromJsxElement(
  element: JsxOpeningElement | JsxSelfClosingElement,
  targetId: string,
  callSiteMap: CallSiteMap,
): void {
  const sourceFile = element.getSourceFile();
  const filePath = sourceFile.getFilePath();

  let info = callSiteMap.get(targetId);
  if (!info) {
    info = new Map();
    callSiteMap.set(targetId, info);
  }

  for (const attr of element.getAttributes()) {
    if (!Node.isJsxAttribute(attr)) continue;

    const propName = attr.getNameNode().getText();
    const initializer = attr.getInitializer();

    let value: ArgValue;
    if (!initializer) {
      // boolean shorthand
      value = new JsxShorthandLiteralArgValue();
    } else if (Node.isJsxExpression(initializer)) {
      const expr = initializer.getExpression();
      value = expr ? extractArgValue(expr) : new UndefinedArgValue();
    } else if (Node.isStringLiteral(initializer)) {
      // JSX属性の文字列値 (例: value="hello")
      // getLiteralValue()で引用符なしの値を取得
      value = new StringLiteralArgValue(initializer.getLiteralValue());
    } else {
      value = new OtherLiteralArgValue(initializer.getText());
    }

    const args = info.get(propName) ?? [];
    args.push({
      name: propName,
      value,
      filePath,
      line: element.getStartLineNumber(),
    });
    info.set(propName, args);
  }
}

/**
 * 関数呼び出しから呼び出し情報を抽出
 */
function extractFromCallExpression(
  callExpr: CallExpression,
  targetId: string,
  paramNames: string[],
  callSiteMap: CallSiteMap,
): void {
  const sourceFile = callExpr.getSourceFile();
  const filePath = sourceFile.getFilePath();

  let info = callSiteMap.get(targetId);
  if (!info) {
    info = new Map();
    callSiteMap.set(targetId, info);
  }

  const args = callExpr.getArguments();
  for (let i = 0; i < paramNames.length; i++) {
    const paramName = paramNames[i];
    const arg = args[i];
    const value: ArgValue = arg
      ? extractArgValue(arg)
      : new UndefinedArgValue();

    const argList = info.get(paramName) ?? [];
    argList.push({
      name: paramName,
      value,
      filePath,
      line: callExpr.getStartLineNumber(),
    });
    info.set(paramName, argList);
  }
}

/**
 * ソースファイルからすべての呼び出し情報を収集する
 */
export function collectCallSites(
  sourceFiles: SourceFile[],
  shouldExcludeFile: FileFilter = isTestOrStorybookFile,
): CallSiteMap {
  const callSiteMap: CallSiteMap = new Map();

  for (const sourceFile of sourceFiles) {
    if (shouldExcludeFile(sourceFile.getFilePath())) continue;

    // JSX要素を収集
    const jsxElements = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];

    for (const element of jsxElements) {
      const tagName = element.getTagNameNode();
      if (!Node.isIdentifier(tagName)) continue;

      const symbol = tagName.getSymbol();
      // インポートを通じて実際の定義を解決する
      const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
      const decl = resolvedSymbol?.getDeclarations()[0];
      if (!decl) continue;

      const declSourceFile = decl.getSourceFile();
      const targetId = createTargetId(
        declSourceFile.getFilePath(),
        tagName.getText(),
      );

      extractFromJsxElement(element, targetId, callSiteMap);
    }

    // 関数呼び出しを収集
    const callExprs = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    );

    for (const callExpr of callExprs) {
      const expr = callExpr.getExpression();
      if (!Node.isIdentifier(expr)) continue;

      const symbol = expr.getSymbol();
      const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
      const decl = resolvedSymbol?.getDeclarations()[0];
      if (!decl) continue;

      // 関数宣言またはアロー関数を含む変数宣言のみ
      // パラメータを取得
      let paramNames: string[] = [];

      if (Node.isFunctionDeclaration(decl)) {
        paramNames = decl.getParameters().map((p) => p.getName());
      } else if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && Node.isArrowFunction(init)) {
          paramNames = init.getParameters().map((p) => p.getName());
        } else if (init && Node.isFunctionExpression(init)) {
          paramNames = init.getParameters().map((p) => p.getName());
        } else {
          continue;
        }
      } else {
        continue;
      }

      const declSourceFile = decl.getSourceFile();
      const targetId = createTargetId(
        declSourceFile.getFilePath(),
        expr.getText(),
      );

      extractFromCallExpression(callExpr, targetId, paramNames, callSiteMap);
    }
  }

  return callSiteMap;
}
