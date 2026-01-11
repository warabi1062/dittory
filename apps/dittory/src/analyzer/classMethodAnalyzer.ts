import { Node } from "ts-morph";
import { AnalyzedDeclarations } from "@/analyzedDeclarations";
import { ExtractUsages } from "@/extraction/extractUsages";
import type {
  AnalyzedDeclaration,
  AnalyzerOptions,
  ClassifiedDeclaration,
} from "@/types";
import { BaseAnalyzer } from "./baseAnalyzer";
import { UsagesByParam } from "./usagesByParam";

/**
 * クラスメソッドの引数分析を行うAnalyzer
 *
 * exportされたクラスのメソッド（static/instance）を収集し、
 * 各メソッドの引数使用状況を分析する。
 * 常に同じ値が渡されている引数を検出し、定数として報告する。
 *
 * @example
 * ```ts
 * const analyzer = new ClassMethodAnalyzer({ minUsages: 2 });
 * const result = analyzer.analyze(declarations);
 * console.log(result.constants);
 * ```
 */
export class ClassMethodAnalyzer extends BaseAnalyzer {
  constructor(options: AnalyzerOptions = {}) {
    super(options);
  }

  /**
   * 事前分類済みの宣言からクラスメソッドを収集する
   *
   * @param classifiedDeclarations - 事前分類済みの宣言配列（type: "class"）
   * @returns 分析対象のメソッドとその使用状況（名前は「ClassName.methodName」形式）
   */
  protected collect(
    classifiedDeclarations: ClassifiedDeclaration[],
  ): AnalyzedDeclarations {
    const analyzedDeclarations = new AnalyzedDeclarations();

    for (const classifiedDeclaration of classifiedDeclarations) {
      const { exportName, sourceFile, declaration } = classifiedDeclaration;

      if (!Node.isClassDeclaration(declaration)) {
        continue;
      }

      const methods = declaration.getMethods();

      for (const method of methods) {
        const methodName = method.getName();
        const parameters = this.getParameterDefinitions(method);

        const usageGroup = new UsagesByParam();
        const analyzed: AnalyzedDeclaration = {
          name: `${exportName}.${methodName}`,
          sourceFilePath: sourceFile.getFilePath(),
          sourceLine: method.getStartLineNumber(),
          definitions: parameters,
          declaration: method,
          usages: usageGroup,
        };

        // メソッド名から参照を検索
        const nameNode = method.getNameNode();
        if (!Node.isIdentifier(nameNode)) {
          continue;
        }

        // 名前ノードから全参照を検索し、除外対象ファイルからの参照をフィルタ
        const references = this.findFilteredReferences(nameNode);

        // 参照からメソッド呼び出しを抽出し、usagesをパラメータ名ごとにグループ化
        for (const reference of references) {
          const refNode = reference.getNode();

          // obj.method の形でPropertyAccessExpressionの一部かチェック
          const propertyAccess = refNode.getParent();
          if (
            !propertyAccess ||
            !Node.isPropertyAccessExpression(propertyAccess)
          ) {
            continue;
          }

          // obj.method(...) の形でCallExpressionかチェック
          const callExpression = propertyAccess.getParent();
          if (!callExpression || !Node.isCallExpression(callExpression)) {
            continue;
          }

          // 呼び出し対象がPropertyAccessExpressionと一致するか確認
          if (callExpression.getExpression() !== propertyAccess) {
            continue;
          }

          // メソッド呼び出しから引数使用状況を抽出
          const usages = ExtractUsages.fromCall(
            callExpression,
            analyzed,
            this.getExpressionResolver(),
          );
          usageGroup.addAll(usages);
        }

        analyzedDeclarations.push(analyzed);
      }
    }

    return analyzedDeclarations;
  }
}
