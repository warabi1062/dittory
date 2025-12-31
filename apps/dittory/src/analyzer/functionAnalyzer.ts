import { Node, type ParameterDeclaration, SyntaxKind } from "ts-morph";
import { ExtractUsages } from "@/extraction/extractUsages";
import type {
  AnalyzerOptions,
  ClassifiedDeclaration,
  Definition,
  Exported,
  Usage,
} from "@/types";
import { BaseAnalyzer } from "./baseAnalyzer";

/**
 * 関数の引数分析を行うAnalyzer
 *
 * exportされた関数を収集し、各関数の引数使用状況を分析する。
 * 常に同じ値が渡されている引数を検出し、定数として報告する。
 *
 * @example
 * ```ts
 * const analyzer = new FunctionAnalyzer({ minUsages: 2 });
 * const result = analyzer.analyze(declarations);
 * console.log(result.constants);
 * ```
 */
export class FunctionAnalyzer extends BaseAnalyzer {
  constructor(options: AnalyzerOptions = {}) {
    super(options);
  }

  /**
   * 事前分類済みの宣言から関数を収集する
   *
   * @param declarations - 事前分類済みの宣言配列（type: "function"）
   * @returns exportされた関数とその使用状況の配列
   */
  protected collect(declarations: ClassifiedDeclaration[]): Exported[] {
    const results: Exported[] = [];

    for (const classified of declarations) {
      const { exportName, sourceFile, declaration } = classified;

      // FunctionDeclaration または VariableDeclaration のみを処理
      if (
        !Node.isFunctionDeclaration(declaration) &&
        !Node.isVariableDeclaration(declaration)
      ) {
        continue;
      }

      // 関数の定義から名前ノードを取得
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

      // 関数の宣言からパラメータ定義を取得
      const parameters = this.getParameters(declaration);

      const callable: Exported = {
        name: exportName,
        sourceFilePath: sourceFile.getFilePath(),
        definitions: parameters,
        declaration,
        usages: {},
      };

      // 参照から関数呼び出しを抽出し、usagesをパラメータ名ごとにグループ化
      const groupedUsages: Record<string, Usage[]> = {};
      for (const reference of references) {
        const refNode = reference.getNode();
        const parent = refNode.getParent();
        if (!parent) {
          continue;
        }

        // func(...) の形で関数呼び出しとして使われているかチェック
        const callExpression = parent.asKind(SyntaxKind.CallExpression);
        if (!callExpression) {
          continue;
        }

        // 呼び出し対象が参照ノードと一致するか確認
        const expression = callExpression.getExpression();
        if (expression !== refNode) {
          continue;
        }

        // 関数呼び出しから引数使用状況を抽出
        const usages = ExtractUsages.fromCall(callExpression, callable);
        for (const usage of usages) {
          if (!groupedUsages[usage.name]) {
            groupedUsages[usage.name] = [];
          }
          groupedUsages[usage.name].push(usage);
        }
      }

      callable.usages = groupedUsages;
      results.push(callable);
    }

    return results;
  }

  /**
   * 関数のパラメータ定義を取得する
   */
  private getParameters(declaration: Node): Definition[] {
    const params = this.extractParameterDeclarations(declaration);

    return params.map((param, index) => ({
      name: param.getName(),
      index,
      required: !param.hasQuestionToken() && !param.hasInitializer(),
    }));
  }

  /**
   * 宣言からParameterDeclarationの配列を抽出する
   */
  private extractParameterDeclarations(
    declaration: Node,
  ): ParameterDeclaration[] {
    if (Node.isFunctionDeclaration(declaration)) {
      return declaration.getParameters();
    }

    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (initializer) {
        if (
          Node.isArrowFunction(initializer) ||
          Node.isFunctionExpression(initializer)
        ) {
          return initializer.getParameters();
        }
      }
    }

    return [];
  }
}
