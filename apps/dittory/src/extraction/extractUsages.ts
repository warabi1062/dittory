import {
  type CallExpression,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
} from "ts-morph";
import type { AnalyzedDeclaration, Definition, Usage } from "@/types";
import {
  JsxShorthandLiteralArgValue,
  UndefinedArgValue,
} from "./argValueClasses";
import type { ExpressionResolver } from "./expressionResolver";
import { hasDisableComment } from "./hasDisableComment";

/**
 * 使用状況を抽出するユーティリティクラス
 */
export class ExtractUsages {
  /**
   * 関数呼び出しから引数の使用状況を抽出する
   *
   * オブジェクトリテラルの場合は再帰的にフラット化し、
   * 各プロパティを「引数名.プロパティ名」形式で記録する。
   *
   * @param callExpression - 関数呼び出しノード
   * @param declaration - 分析対象の関数情報
   * @param resolver - 式を解決するためのリゾルバ
   * @returns 引数使用状況の配列
   */
  static fromCall(
    callExpression: CallExpression,
    declaration: AnalyzedDeclaration,
    resolver: ExpressionResolver,
  ): Usage[] {
    // dittory-disable-next-line コメントがある場合は除外
    if (hasDisableComment(callExpression)) {
      return [];
    }

    const usages: Usage[] = [];
    const sourceFile = callExpression.getSourceFile();
    const args = callExpression.getArguments();

    for (const definition of declaration.definitions) {
      const arg = args[definition.index];

      if (!arg) {
        // 引数が渡されていない場合はundefinedとして記録
        usages.push({
          name: definition.name,
          value: new UndefinedArgValue(),
          usageFilePath: sourceFile.getFilePath(),
          usageLine: callExpression.getStartLineNumber(),
        });
        continue;
      }

      // オブジェクトリテラルの場合は再帰的にフラット化
      for (const { key, value } of resolver.flattenObject(
        arg,
        definition.name,
      )) {
        usages.push({
          name: key,
          value,
          usageFilePath: sourceFile.getFilePath(),
          usageLine: arg.getStartLineNumber(),
        });
      }
    }

    return usages;
  }

  /**
   * JSX要素からprops使用状況を抽出する
   *
   * @param element - JSX要素ノード
   * @param definitions - props定義の配列
   * @param resolver - 式を解決するためのリゾルバ
   * @returns props使用状況の配列
   */
  static fromJsxElement(
    element: JsxOpeningElement | JsxSelfClosingElement,
    definitions: Definition[],
    resolver: ExpressionResolver,
  ): Usage[] {
    // dittory-disable-next-line コメントがある場合は除外
    if (hasDisableComment(element)) {
      return [];
    }

    const usages: Usage[] = [];
    const sourceFile = element.getSourceFile();

    // JSX属性をMapに変換
    const attributeMap = new Map<string, JsxAttribute>();
    for (const attr of element.getAttributes()) {
      if (Node.isJsxAttribute(attr)) {
        attributeMap.set(attr.getNameNode().getText(), attr);
      }
    }

    // definitionsをループして処理
    for (const definition of definitions) {
      const attr = attributeMap.get(definition.name);

      if (!attr) {
        // 渡されていない場合（required/optional問わず記録）
        usages.push({
          name: definition.name,
          value: new UndefinedArgValue(),
          usageFilePath: sourceFile.getFilePath(),
          usageLine: element.getStartLineNumber(),
        });
        continue;
      }

      // 属性が渡されている場合、値を抽出
      const initializer = attr.getInitializer();

      if (!initializer) {
        // boolean shorthand (例: <Component disabled />)
        usages.push({
          name: definition.name,
          value: new JsxShorthandLiteralArgValue(),
          usageFilePath: sourceFile.getFilePath(),
          usageLine: attr.getStartLineNumber(),
        });
      } else if (Node.isJsxExpression(initializer)) {
        // {expression} 形式
        const expression = initializer.getExpression();
        if (!expression) {
          continue;
        }
        for (const { key, value } of resolver.flattenObject(
          expression,
          definition.name,
        )) {
          usages.push({
            name: key,
            value,
            usageFilePath: sourceFile.getFilePath(),
            usageLine: attr.getStartLineNumber(),
          });
        }
      } else {
        // "string" 形式 - resolverを通して解決
        usages.push({
          name: definition.name,
          value: resolver.resolve(initializer),
          usageFilePath: sourceFile.getFilePath(),
          usageLine: attr.getStartLineNumber(),
        });
      }
    }

    return usages;
  }
}
