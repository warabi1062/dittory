import { Node, type ParameterDeclaration } from "ts-morph";
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
   * @param declarations - 事前分類済みの宣言配列（type: "class"）
   * @returns クラスメソッドとその使用状況の配列（名前は「ClassName.methodName」形式）
   */
  protected collect(declarations: ClassifiedDeclaration[]): Exported[] {
    const results: Exported[] = [];

    for (const classified of declarations) {
      const { exportName, sourceFile, declaration } = classified;

      if (!Node.isClassDeclaration(declaration)) {
        continue;
      }

      const methods = declaration.getMethods();

      for (const method of methods) {
        const methodName = method.getName();
        const parameters = this.getParameters(method);

        const callable: Exported = {
          name: `${exportName}.${methodName}`,
          sourceFilePath: sourceFile.getFilePath(),
          definitions: parameters,
          declaration: method,
          usages: {},
        };

        // メソッド名から参照を検索
        const nameNode = method.getNameNode();
        if (!Node.isIdentifier(nameNode)) {
          continue;
        }

        // 名前ノードから全参照を検索し、除外対象ファイルからの参照をフィルタ
        const references = nameNode
          .findReferences()
          .flatMap((referencedSymbol) => referencedSymbol.getReferences())
          .filter(
            (ref) => !this.shouldExcludeFile(ref.getSourceFile().getFilePath()),
          );

        // 参照からメソッド呼び出しを抽出し、usagesをパラメータ名ごとにグループ化
        const groupedUsages: Record<string, Usage[]> = {};
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
    }

    return results;
  }

  /**
   * メソッドのパラメータ定義を取得する
   */
  private getParameters(method: Node): Definition[] {
    const params = this.extractParameterDeclarations(method);

    return params.map((param, index) => ({
      name: param.getName(),
      index,
      required: !param.hasQuestionToken() && !param.hasInitializer(),
    }));
  }

  /**
   * メソッド宣言からParameterDeclarationの配列を抽出する
   */
  private extractParameterDeclarations(method: Node): ParameterDeclaration[] {
    if (Node.isMethodDeclaration(method)) {
      return method.getParameters();
    }

    return [];
  }
}
