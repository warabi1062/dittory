import { Node, SyntaxKind } from "ts-morph";
import { AnalyzedDeclarations } from "@/analyzedDeclarations";
import { ExtractUsages } from "@/extraction/extractUsages";
import type {
  AnalyzedDeclaration,
  AnalyzerOptions,
  ClassifiedDeclaration,
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
   * @param classifiedDeclarations - 事前分類済みの宣言配列（type: "function"）
   * @returns 分析対象の関数とその使用状況
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

      // 関数の定義から名前ノードを取得
      const nameNode = declaration.getNameNode();
      if (!nameNode || !Node.isIdentifier(nameNode)) {
        continue;
      }

      // 名前ノードから全参照を検索し、除外対象ファイルからの参照をフィルタ
      const references = this.findFilteredReferences(nameNode);

      // 関数の宣言からパラメータ定義を取得
      const parameters = this.getParameterDefinitions(declaration);

      const analyzed: AnalyzedDeclaration = {
        name: exportName,
        sourceFilePath: sourceFile.getFilePath(),
        sourceLine: declaration.getStartLineNumber(),
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
        const usages = ExtractUsages.fromCall(
          callExpression,
          analyzed,
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
