import {
  type CallExpression,
  type Identifier,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import type { FileFilter } from "@/domain/analyzerOptions";
import { CallSiteMap } from "@/domain/callSiteMap";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import { extractArgValue } from "./extractArgValue";

/**
 * ソースファイルから呼び出し情報を収集する
 */
export class CallSiteCollector {
  private shouldExcludeFile: FileFilter;
  private callSiteMap: CallSiteMap;

  constructor(shouldExcludeFile: FileFilter = isTestOrStorybookFile) {
    this.shouldExcludeFile = shouldExcludeFile;
    this.callSiteMap = new CallSiteMap();
  }

  /**
   * ソースファイルからすべての呼び出し情報を収集する
   */
  collect(sourceFiles: SourceFile[]): CallSiteMap {
    for (const sourceFile of sourceFiles) {
      if (this.shouldExcludeFile(sourceFile.getFilePath())) continue;

      // JSX要素を収集
      for (const jsxElement of sourceFile.getDescendantsOfKind(
        SyntaxKind.JsxOpeningElement,
      )) {
        this.extractFromJsxElement(jsxElement);
      }
      for (const jsxElement of sourceFile.getDescendantsOfKind(
        SyntaxKind.JsxSelfClosingElement,
      )) {
        this.extractFromJsxElement(jsxElement);
      }

      // 関数呼び出しを収集
      for (const callExpression of sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression,
      )) {
        this.extractFromCallExpression(callExpression);
      }
    }

    return this.callSiteMap;
  }

  /**
   * JSX要素から呼び出し情報を抽出して登録する
   * タグ名がIdentifierでない場合や、宣言が解決できない場合は何もしない
   */
  private extractFromJsxElement(
    jsxElement: JsxOpeningElement | JsxSelfClosingElement,
  ): void {
    const tagName = jsxElement.getTagNameNode();
    // JSXタグ名は Identifier（例: <Button />）または
    // PropertyAccessExpression（例: <Icons.Home />）のどちらか。
    // ここでは単純な識別子のみを対象とし、名前空間付きはスキップする
    if (!Node.isIdentifier(tagName)) return;

    const declaration = this.getDeclaration(tagName);
    if (!declaration) return;

    const targetId = this.createTargetId(declaration, tagName.getText());
    const filePath = jsxElement.getSourceFile().getFilePath();
    const line = jsxElement.getStartLineNumber();

    const attributesWithName = this.getAttributesWithName(jsxElement);

    for (const { name, node } of attributesWithName) {
      this.callSiteMap.addArg(targetId, {
        name,
        value: extractArgValue(node),
        filePath,
        line,
      });
    }
  }

  /**
   * 関数呼び出しから呼び出し情報を抽出して登録する
   * 呼び出し式がIdentifierでない場合や、宣言が解決できない場合は何もしない
   */
  private extractFromCallExpression(callExpression: CallExpression): void {
    const calleeExpression = callExpression.getExpression();
    if (!Node.isIdentifier(calleeExpression)) return;

    const declaration = this.getDeclaration(calleeExpression);
    if (!declaration) return;

    const targetId = this.createTargetId(
      declaration,
      calleeExpression.getText(),
    );
    const filePath = callExpression.getSourceFile().getFilePath();
    const line = callExpression.getStartLineNumber();

    const argsWithName = this.getArgsWithName(
      declaration,
      callExpression.getArguments(),
    );

    for (const { name, node } of argsWithName) {
      this.callSiteMap.addArg(targetId, {
        name,
        value: extractArgValue(node),
        filePath,
        line,
      });
    }
  }

  /**
   * 宣言からパラメータ名と引数ノードのペア配列を取得する
   * 関数宣言、アロー関数、関数式に対応
   * 引数が省略されている場合、node は undefined になる
   */
  private getArgsWithName(
    declaration: Node,
    args: Node[],
  ): { name: string; node: Node | undefined }[] {
    let paramNames: string[] = [];

    if (Node.isFunctionDeclaration(declaration)) {
      paramNames = declaration.getParameters().map((p) => p.getName());
    } else if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (
        initializer &&
        (Node.isArrowFunction(initializer) ||
          Node.isFunctionExpression(initializer))
      ) {
        paramNames = initializer.getParameters().map((p) => p.getName());
      }
    }

    return paramNames.map((name, i) => ({ name, node: args[i] }));
  }

  /**
   * JSX要素から属性名とノードのペア配列を取得する
   */
  private getAttributesWithName(
    jsxElement: JsxOpeningElement | JsxSelfClosingElement,
  ): { name: string; node: Node }[] {
    return jsxElement
      .getAttributes()
      .filter(Node.isJsxAttribute)
      .map((attr) => ({ name: attr.getNameNode().getText(), node: attr }));
  }

  /**
   * 宣言ノードと名前からtargetIdを生成する
   * 形式: "{ファイルパス}:{名前}"
   */
  private createTargetId(declaration: Node, name: string): string {
    return `${declaration.getSourceFile().getFilePath()}:${name}`;
  }

  /**
   * 識別子から定義元の宣言ノードを取得する
   * インポートを通じて実際の定義を解決し、宣言ノードを返す
   */
  private getDeclaration(identifier: Identifier): Node | undefined {
    const symbol = identifier.getSymbol();
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    return resolvedSymbol?.getDeclarations()[0];
  }
}
