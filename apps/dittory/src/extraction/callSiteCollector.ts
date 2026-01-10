import { type Identifier, Node, type SourceFile, SyntaxKind } from "ts-morph";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type { FileFilter } from "@/types";
import { CallSiteMap } from "./callSiteMap";

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
 * 識別子から定義元のファイルパスを取得する
 * インポートを通じて実際の定義を解決し、そのファイルパスを返す
 */
function getDefinitionFilePath(identifier: Identifier): string | undefined {
  const symbol = identifier.getSymbol();
  // インポートを通じて実際の定義を解決する
  const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
  // シンボルから宣言ノード（関数宣言など）を取得し、定義元ファイルパスを特定する
  // オーバーロードや interface マージで複数宣言がある場合があるが、
  // コンポーネントは通常1つなので最初の宣言を使用
  const decl = resolvedSymbol?.getDeclarations()[0];
  if (!decl) return undefined;

  return decl.getSourceFile().getFilePath();
}

/**
 * ソースファイルからすべての呼び出し情報を収集する
 */
export function collectCallSites(
  sourceFiles: SourceFile[],
  shouldExcludeFile: FileFilter = isTestOrStorybookFile,
): CallSiteMap {
  const callSiteMap = new CallSiteMap();

  for (const sourceFile of sourceFiles) {
    if (shouldExcludeFile(sourceFile.getFilePath())) continue;

    // JSX要素を収集
    const jsxElements = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];

    for (const jsxElement of jsxElements) {
      const tagName = jsxElement.getTagNameNode();
      // JSXタグ名は Identifier（例: <Button />）または
      // PropertyAccessExpression（例: <Icons.Home />）のどちらか。
      // ここでは単純な識別子のみを対象とし、名前空間付きはスキップする
      if (!Node.isIdentifier(tagName)) continue;

      const filePath = getDefinitionFilePath(tagName);
      if (!filePath) continue;

      const targetId = createTargetId(filePath, tagName.getText());

      callSiteMap.extractFromJsxElement(jsxElement, targetId);
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

      callSiteMap.extractFromCallExpression(callExpr, targetId, paramNames);
    }
  }

  return callSiteMap;
}
