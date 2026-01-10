import { type Identifier, Node, type SourceFile, SyntaxKind } from "ts-morph";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type { FileFilter } from "@/types";
import { CallSiteMap, type ParamWithArg } from "./callSiteMap";

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
 * 識別子から定義元の宣言ノードを取得する
 * インポートを通じて実際の定義を解決し、宣言ノードを返す
 *
 * オーバーロードや interface マージで複数宣言がある場合があるが、
 * 関数/コンポーネントは通常1つなので最初の宣言を使用
 */
function getDeclaration(identifier: Identifier): Node | undefined {
  const symbol = identifier.getSymbol();
  // インポートを通じて実際の定義を解決する
  const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
  return resolvedSymbol?.getDeclarations()[0];
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

      const decl = getDeclaration(tagName);
      if (!decl) continue;

      const targetId = createTargetId(
        decl.getSourceFile().getFilePath(),
        tagName.getText(),
      );

      callSiteMap.extractFromJsxElement(jsxElement, targetId);
    }

    // 関数呼び出しを収集
    const callExprs = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    );

    for (const callExpr of callExprs) {
      const expr = callExpr.getExpression();
      if (!Node.isIdentifier(expr)) continue;

      const decl = getDeclaration(expr);
      if (!decl) continue;

      const targetId = createTargetId(
        decl.getSourceFile().getFilePath(),
        expr.getText(),
      );

      // 宣言形式に応じてパラメータ名を取得し、呼び出し情報を登録
      const args = callExpr.getArguments();

      const buildParams = (
        parameters: { getName(): string }[],
      ): ParamWithArg[] =>
        parameters.map((p, i) => ({ name: p.getName(), arg: args[i] }));

      if (Node.isFunctionDeclaration(decl)) {
        // function foo(a, b) {} 形式
        const params = buildParams(decl.getParameters());
        callSiteMap.extractFromCallExpression(callExpr, targetId, params);
      } else if (Node.isVariableDeclaration(decl)) {
        // 変数宣言の場合、初期化子が関数かどうかを確認
        const init = decl.getInitializer();
        if (init && Node.isArrowFunction(init)) {
          // const foo = (a, b) => {} 形式
          const params = buildParams(init.getParameters());
          callSiteMap.extractFromCallExpression(callExpr, targetId, params);
        } else if (init && Node.isFunctionExpression(init)) {
          // const foo = function(a, b) {} 形式
          const params = buildParams(init.getParameters());
          callSiteMap.extractFromCallExpression(callExpr, targetId, params);
        }
        // 関数以外の変数宣言（定数など）はスキップ
      }
      // クラス宣言など、関数以外の宣言はスキップ
    }
  }

  return callSiteMap;
}
