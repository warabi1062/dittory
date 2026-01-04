import { Node } from "ts-morph";
import {
  type ResolveContext,
  resolveExpressionValue,
} from "@/extraction/resolveExpressionValue";

export type FlattenedValue = { key: string; value: string };

/**
 * オブジェクトリテラルを再帰的に解析し、フラットなkey-valueペアを返す
 *
 * @param expression - 解析対象の式ノード
 * @param prefix - キー名のプレフィックス（ネストしたプロパティの親パスを表す）
 * @param context - 呼び出し情報などのコンテキスト（オプション）
 * @returns フラット化されたkey-valueペアの配列
 *
 * @example
 * // { a: { b: 1, c: 2 } } → [{ key: "prefix.a.b", value: "1" }, { key: "prefix.a.c", value: "2" }]
 */
export function flattenObjectExpression(
  expression: Node,
  prefix: string,
  context?: ResolveContext,
): FlattenedValue[] {
  if (!Node.isObjectLiteralExpression(expression)) {
    // オブジェクトリテラル以外の場合は単一の値として返す
    return [
      { key: prefix, value: resolveExpressionValue(expression, context) },
    ];
  }

  return expression.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property)) {
      const propertyName = property.getName();
      const nestedPrefix = prefix ? `${prefix}.${propertyName}` : propertyName;
      const initializer = property.getInitializer();

      return initializer
        ? flattenObjectExpression(initializer, nestedPrefix, context)
        : [];
    }

    if (Node.isShorthandPropertyAssignment(property)) {
      // { foo } のような省略形
      const propertyName = property.getName();
      const nestedPrefix = prefix ? `${prefix}.${propertyName}` : propertyName;
      return [
        {
          key: nestedPrefix,
          value: resolveExpressionValue(property.getNameNode(), context),
        },
      ];
    }

    return [];
  });
}
