import { Node, SyntaxKind } from "ts-morph";
import { AnalyzedDeclarations } from "@/analyzedDeclarations";
import { ExtractUsages } from "@/extraction/extractUsages";
import { getProps } from "@/react/getProps";
import type {
  AnalyzedDeclaration,
  AnalyzerOptions,
  ClassifiedDeclaration,
  Usage,
} from "@/types";
import { BaseAnalyzer } from "./baseAnalyzer";

/**
 * Reactコンポーネントのprops分析を行うAnalyzer
 *
 * exportされたReactコンポーネントを収集し、各コンポーネントのprops使用状況を分析する。
 * 常に同じ値が渡されているpropsを検出し、定数として報告する。
 *
 * @example
 * ```ts
 * const analyzer = new ComponentAnalyzer({ minUsages: 2 });
 * const result = analyzer.analyze(sourceFiles);
 * console.log(result.constants);
 * ```
 */
export class ComponentAnalyzer extends BaseAnalyzer {
  constructor(options: AnalyzerOptions = {}) {
    super(options);
  }

  /**
   * 事前分類済みの宣言からReactコンポーネントを収集する
   *
   * @param classifiedDeclarations - 事前分類済みの宣言配列
   * @returns 分析対象のコンポーネントとその使用状況
   */
  protected collect(
    classifiedDeclarations: ClassifiedDeclaration[],
  ): AnalyzedDeclarations {
    const analyzedDeclarations = new AnalyzedDeclarations();

    for (const classifiedDeclaration of classifiedDeclarations) {
      const { exportName, sourceFile, declaration } = classifiedDeclaration;

      // FunctionDeclaration または VariableDeclaration のみを処理
      if (
        !Node.isFunctionDeclaration(declaration) &&
        !Node.isVariableDeclaration(declaration)
      ) {
        continue;
      }

      // コンポーネントの定義から名前ノードを取得
      const nameNode = declaration.getNameNode();
      if (!nameNode || !Node.isIdentifier(nameNode)) {
        continue;
      }

      // 名前ノードから全参照を検索し、除外対象ファイルからの参照をフィルタ
      const references = this.findFilteredReferences(nameNode);

      // コンポーネントの宣言からprops定義を取得
      const props = getProps(declaration);

      const analyzed: AnalyzedDeclaration = {
        name: exportName,
        sourceFilePath: sourceFile.getFilePath(),
        sourceLine: declaration.getStartLineNumber(),
        definitions: props,
        declaration,
        usages: {},
      };

      // 参照からJSX要素を抽出し、usagesをprop名ごとにグループ化
      const groupedUsages: Record<string, Usage[]> = {};
      for (const reference of references) {
        const refNode = reference.getNode();
        const parent = refNode.getParent();
        if (!parent) {
          continue;
        }

        // <Component> または <Component /> の形でJSX要素として使われているかチェック
        const jsxElement =
          parent.asKind(SyntaxKind.JsxOpeningElement) ??
          parent.asKind(SyntaxKind.JsxSelfClosingElement);

        if (!jsxElement) {
          continue;
        }

        // タグ名ノードが参照ノードと一致するか確認
        const tagNameNode = jsxElement.getTagNameNode();
        if (tagNameNode !== refNode) {
          continue;
        }

        // JSX要素からprops使用状況を抽出
        const usages = ExtractUsages.fromJsxElement(
          jsxElement,
          analyzed.definitions,
          this.getExpressionResolver(),
        );
        this.addUsagesToGroup(groupedUsages, usages);
      }

      analyzed.usages = groupedUsages;
      analyzedDeclarations.push(analyzed);
    }

    return analyzedDeclarations;
  }
}
