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
import { createParameterRef, isParameterReference } from "./parameterUtils";

/**
 * 呼び出し箇所での引数情報
 */
export interface CallSiteArg {
  /** 引数のインデックス（0始まり）またはプロパティ名 */
  name: string;
  /** 引数の値（リテラル値は解決済み、パラメータ参照は "[param]..." 形式） */
  value: string;
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
 * 式からリテラル値を抽出する（パラメータ参照は解決しない簡易版）
 * 呼び出し情報収集時に使用する
 */
function extractLiteralValue(expression: Node): string {
  const type = expression.getType();

  // 関数型の場合はファイルパス+行番号でユニーク化
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return `[function]${sourceFile.getFilePath()}:${line}`;
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
        return `${filePath}:${enumName}.${memberName}=${JSON.stringify(value)}`;
      }
    }

    // パラメータのプロパティアクセスの場合
    if (isParameterReference(expression.getExpression())) {
      return createParameterRef(expression);
    }
  }

  // Identifier (変数参照)
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return "undefined";
    }

    const symbol = expression.getSymbol();
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    const decl = resolvedSymbol?.getDeclarations()[0];

    if (decl) {
      const kind = decl.getKind();
      // パラメータまたはBindingElementの場合
      if (kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement) {
        return createParameterRef(expression);
      }

      // 変数宣言の場合は初期化子を再帰的に解決
      if (Node.isVariableDeclaration(decl)) {
        const initializer = decl.getInitializer();
        if (initializer) {
          return extractLiteralValue(initializer);
        }
        return `${decl.getSourceFile().getFilePath()}:${expression.getText()}`;
      }
    }
  }

  // リテラル型
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return JSON.stringify(type.getLiteralValue());
  }

  if (type.isBooleanLiteral()) {
    return type.getText();
  }

  return expression.getText();
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

    let value: string;
    if (!initializer) {
      // boolean shorthand
      value = "true";
    } else if (Node.isJsxExpression(initializer)) {
      const expr = initializer.getExpression();
      value = expr ? extractLiteralValue(expr) : "undefined";
    } else {
      value = initializer.getText();
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
    const value = arg ? extractLiteralValue(arg) : "undefined";

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
