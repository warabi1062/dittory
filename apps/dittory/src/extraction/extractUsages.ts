import {
  type CallExpression,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
} from "ts-morph";
import type { Definition, Exported, Usage } from "@/types";
import { flattenObjectExpression } from "./flattenObjectExpression";
import { hasDisableComment } from "./hasDisableComment";
import { type ResolveContext, UNDEFINED_VALUE } from "./resolveExpressionValue";

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
   * @param callable - 対象の関数情報
   * @param context - 呼び出し情報などのコンテキスト（オプション）
   * @returns 引数使用状況の配列
   */
  static fromCall(
    callExpression: CallExpression,
    callable: Exported,
    context?: ResolveContext,
  ): Usage[] {
    // dittory-disable-next-line コメントがある場合は除外
    if (hasDisableComment(callExpression)) {
      return [];
    }

    const usages: Usage[] = [];
    const sourceFile = callExpression.getSourceFile();
    const args = callExpression.getArguments();

    for (const param of callable.definitions) {
      const arg = args[param.index];

      if (!arg) {
        // 引数が渡されていない場合はundefinedとして記録
        usages.push({
          name: param.name,
          value: UNDEFINED_VALUE,
          usageFilePath: sourceFile.getFilePath(),
          usageLine: callExpression.getStartLineNumber(),
        });
        continue;
      }

      // オブジェクトリテラルの場合は再帰的にフラット化
      for (const { key, value } of flattenObjectExpression(
        arg,
        param.name,
        context,
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
   * @param context - 呼び出し情報などのコンテキスト（オプション）
   * @returns props使用状況の配列
   */
  static fromJsxElement(
    element: JsxOpeningElement | JsxSelfClosingElement,
    definitions: Definition[],
    context?: ResolveContext,
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
    for (const prop of definitions) {
      const attr = attributeMap.get(prop.name);

      if (!attr) {
        // 渡されていない場合（required/optional問わず記録）
        usages.push({
          name: prop.name,
          value: UNDEFINED_VALUE,
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
          name: prop.name,
          value: "true",
          usageFilePath: sourceFile.getFilePath(),
          usageLine: attr.getStartLineNumber(),
        });
      } else if (Node.isJsxExpression(initializer)) {
        // {expression} 形式
        const expression = initializer.getExpression();
        if (!expression) {
          continue;
        }
        for (const { key, value } of flattenObjectExpression(
          expression,
          prop.name,
          context,
        )) {
          usages.push({
            name: key,
            value,
            usageFilePath: sourceFile.getFilePath(),
            usageLine: attr.getStartLineNumber(),
          });
        }
      } else {
        // "string" 形式
        usages.push({
          name: prop.name,
          value: initializer.getText(),
          usageFilePath: sourceFile.getFilePath(),
          usageLine: attr.getStartLineNumber(),
        });
      }
    }

    return usages;
  }
}
