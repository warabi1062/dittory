import { Node, SyntaxKind } from "ts-morph";
import { getProps } from "@/components/getProps";
import { ExtractUsages } from "@/extraction/extractUsages";
import type {
  AnalyzerOptions,
  ClassifiedDeclaration,
  Exported,
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
   * @param declarations - 事前分類済みの宣言配列
   * @returns exportされたコンポーネントとその使用状況の配列
   */
  protected collect(declarations: ClassifiedDeclaration[]): Exported[] {
    const exportedComponents: Exported[] = [];

    for (const classified of declarations) {
      const { exportName, sourceFile, declaration } = classified;

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
      const references = nameNode
        .findReferences()
        .flatMap((referencedSymbol) => referencedSymbol.getReferences())
        .filter(
          (ref) => !this.shouldExcludeFile(ref.getSourceFile().getFilePath()),
        );

      // コンポーネントの宣言からprops定義を取得
      const props = getProps(declaration);

      const component: Exported = {
        name: exportName,
        sourceFilePath: sourceFile.getFilePath(),
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
          component.definitions,
        );
        for (const usage of usages) {
          if (!groupedUsages[usage.name]) {
            groupedUsages[usage.name] = [];
          }
          groupedUsages[usage.name].push(usage);
        }
      }

      component.usages = groupedUsages;
      exportedComponents.push(component);
    }

    return exportedComponents;
  }
}
