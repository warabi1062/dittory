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

/**
 * ArgValueのtype識別子
 */
export const ArgValueType = {
  Literal: "literal",
  Function: "function",
  ParamRef: "paramRef",
  Undefined: "undefined",
} as const;

/**
 * 引数の値を表す union 型
 * 文字列エンコーディングの代わりに型安全な表現を使用
 */
export type ArgValue =
  | { type: typeof ArgValueType.Literal; value: string }
  | { type: typeof ArgValueType.Function; filePath: string; line: number }
  | {
      type: typeof ArgValueType.ParamRef;
      filePath: string;
      functionName: string;
      path: string;
    }
  | { type: typeof ArgValueType.Undefined };

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
    return {
      type: ArgValueType.Function,
      filePath: sourceFile.getFilePath(),
      line,
    };
  }

  // PropertyAccessExpression (例: Status.Active, props.number)
  if (Node.isPropertyAccessExpression(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];

    // enum memberの場合
    if (decl && Node.isEnumMember(decl)) {
      const enumDecl = decl.getParent();
      if (Node.isEnumDeclaration(enumDecl)) {
        const filePath = enumDecl.getSourceFile().getFilePath();
        const enumName = enumDecl.getName();
        const memberName = decl.getName();
        const value = decl.getValue();
        return {
          type: ArgValueType.Literal,
          value: `${filePath}:${enumName}.${memberName}=${JSON.stringify(value)}`,
        };
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
      const sourceFile = expression.getSourceFile();
      const line = expression.getStartLineNumber();
      return {
        type: ArgValueType.Literal,
        value: `[this]${sourceFile.getFilePath()}:${line}:${expression.getText()}`,
      };
    }
  }

  // Identifier (変数参照)
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return { type: ArgValueType.Undefined };
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
        return {
          type: ArgValueType.Literal,
          value: `${decl.getSourceFile().getFilePath()}:${expression.getText()}`,
        };
      }

      // その他の宣言タイプ（インポート宣言など）
      // ファイルパス + 変数名で識別する
      return {
        type: ArgValueType.Literal,
        value: `${decl.getSourceFile().getFilePath()}:${expression.getText()}`,
      };
    }
  }

  // リテラル型
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return {
      type: ArgValueType.Literal,
      value: JSON.stringify(type.getLiteralValue()),
    };
  }

  if (type.isBooleanLiteral()) {
    return { type: ArgValueType.Literal, value: type.getText() };
  }

  return { type: ArgValueType.Literal, value: expression.getText() };
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
      value = { type: ArgValueType.Literal, value: "true" };
    } else if (Node.isJsxExpression(initializer)) {
      const expr = initializer.getExpression();
      value = expr ? extractArgValue(expr) : { type: ArgValueType.Undefined };
    } else {
      value = { type: ArgValueType.Literal, value: initializer.getText() };
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
      : { type: ArgValueType.Undefined };

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
