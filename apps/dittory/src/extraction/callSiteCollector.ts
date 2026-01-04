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
    if (isParameterPropertyAccess(expression)) {
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
 * 式がパラメータのプロパティアクセスかどうかを判定
 */
function isParameterPropertyAccess(expression: Node): boolean {
  if (Node.isIdentifier(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];
    if (!decl) return false;
    const kind = decl.getKind();
    return kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement;
  }
  if (Node.isPropertyAccessExpression(expression)) {
    return isParameterPropertyAccess(expression.getExpression());
  }
  return false;
}

/**
 * パラメータ参照の識別子を作成
 * 形式: "[param]ファイルパス:関数名:パラメータ名.プロパティパス"
 */
function createParameterRef(expression: Node): string {
  // 式から関数スコープを特定
  const functionScope = findContainingFunction(expression);
  if (!functionScope) {
    // フォールバック: ファイルパス+行番号
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return `[param]${sourceFile.getFilePath()}:${line}`;
  }

  const { filePath, functionName, parameterPath } =
    extractParameterInfo(expression);

  return `[param]${filePath}:${functionName}:${parameterPath}`;
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
 * パラメータ参照から情報を抽出
 */
function extractParameterInfo(expression: Node): {
  filePath: string;
  functionName: string;
  parameterPath: string;
} {
  const sourceFile = expression.getSourceFile();
  const filePath = sourceFile.getFilePath();

  // 関数名を取得
  const functionScope = findContainingFunction(expression);
  let functionName = "anonymous";

  if (functionScope) {
    if (Node.isFunctionDeclaration(functionScope)) {
      functionName = functionScope.getName() ?? "anonymous";
    } else if (
      Node.isArrowFunction(functionScope) ||
      Node.isFunctionExpression(functionScope)
    ) {
      // 変数宣言からの名前を取得
      const parent = functionScope.getParent();
      if (parent && Node.isVariableDeclaration(parent)) {
        functionName = parent.getName();
      }
    } else if (Node.isMethodDeclaration(functionScope)) {
      const className = functionScope
        .getParent()
        ?.asKind(SyntaxKind.ClassDeclaration)
        ?.getName();
      const methodName = functionScope.getName();
      functionName = className ? `${className}.${methodName}` : methodName;
    }
  }

  // パラメータパスを構築 (例: "props.number")
  const parameterPath = buildParameterPath(expression);

  return { filePath, functionName, parameterPath };
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

/** 再帰解決のデフォルト最大深さ */
export const DEFAULT_MAX_DEPTH = 10;

/**
 * パラメータ参照を解決する
 * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
 * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
 *
 * @param paramRef - パラメータ参照文字列
 * @param callSiteMap - 呼び出し情報マップ
 * @param visited - 循環参照防止用のセット
 * @param depth - 現在の再帰深さ
 * @param maxDepth - 最大再帰深さ（デフォルト: 10）
 */
export function resolveParameterValue(
  paramRef: string,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): string | undefined {
  // 深さ制限チェック
  if (depth >= maxDepth) {
    return undefined;
  }

  // 循環参照を防ぐ
  if (visited.has(paramRef)) {
    return undefined;
  }
  visited.add(paramRef);

  // paramRefの形式: "[param]ファイルパス:関数名:パラメータパス"
  if (!paramRef.startsWith("[param]")) {
    return paramRef;
  }

  const content = paramRef.substring("[param]".length);
  const parts = content.split(":");
  if (parts.length < 3) {
    return undefined;
  }

  // ファイルパスに:が含まれる可能性があるため、最後の2つを関数名とパラメータパス、残りをファイルパスとする
  // 上で parts.length >= 3 を検証済みなので必ず値が存在する
  const parameterPath = parts[parts.length - 1];
  const functionName = parts[parts.length - 2];
  const filePath = parts.slice(0, -2).join(":");

  const targetId = createTargetId(filePath, functionName);
  const callSiteInfo = callSiteMap.get(targetId);
  if (!callSiteInfo) {
    return undefined;
  }

  // パラメータパスからルートパラメータ名とプロパティパスを抽出
  // 例: "props.number" → rootParam="props", propertyPath=["number"]
  // 例: "a" → rootParam="a", propertyPath=[]
  const paramParts = parameterPath.split(".");
  const rootParam = paramParts[0];
  const propertyPath = paramParts.slice(1);

  // すべての呼び出し箇所で渡された値を収集
  const resolvedValues = new Set<string>();

  // JSXコンポーネントの場合: props.number に対して、呼び出し側では number= で渡される
  // なので propertyPath がある場合は最後のプロパティ名で検索
  if (propertyPath.length > 0) {
    const propName = propertyPath[propertyPath.length - 1];
    const propArgs = callSiteInfo.get(propName);

    if (propArgs && propArgs.length > 0) {
      for (const propArg of propArgs) {
        let propValue = propArg.value;
        // 再帰的にパラメータ参照を解決
        if (propValue.startsWith("[param]")) {
          const resolved = resolveParameterValue(
            propValue,
            callSiteMap,
            new Set(visited),
            depth + 1,
            maxDepth,
          );
          if (resolved === undefined) {
            return undefined;
          }
          propValue = resolved;
        }
        resolvedValues.add(propValue);
      }
    } else {
      // プロパティが見つからない場合
      return undefined;
    }
  } else {
    // 通常の関数引数の場合: rootParam で直接検索
    const args = callSiteInfo.get(rootParam);
    if (!args || args.length === 0) {
      return undefined;
    }

    for (const arg of args) {
      let value = arg.value;
      // 再帰的にパラメータ参照を解決
      if (value.startsWith("[param]")) {
        const resolved = resolveParameterValue(
          value,
          callSiteMap,
          new Set(visited),
          depth + 1,
          maxDepth,
        );
        if (resolved === undefined) {
          return undefined;
        }
        value = resolved;
      }
      resolvedValues.add(value);
    }
  }

  // すべて同じ値なら、その値を返す
  if (resolvedValues.size === 1) {
    return [...resolvedValues][0];
  }

  // 異なる値がある場合は解決不可を示す undefined を返す
  // 注意: これは UNDEFINED_VALUE（実際に undefined が渡された場合）とは異なる
  return undefined;
}
