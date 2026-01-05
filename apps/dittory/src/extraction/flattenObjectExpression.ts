import { Node, type ObjectLiteralExpression, type Type } from "ts-morph";
import {
  type ResolveContext,
  resolveExpressionValue,
  UNDEFINED_VALUE,
} from "@/extraction/resolveExpressionValue";

export type FlattenedValue = { key: string; value: string };

/**
 * オブジェクトリテラルを再帰的に解析し、フラットなkey-valueペアを返す
 *
 * 期待される型（コンテキスト型）から省略されたプロパティも検出し、
 * [undefined] として記録する。
 *
 * @param expression - 解析対象の式ノード
 * @param prefix - キー名のプレフィックス（ネストしたプロパティの親パスを表す）
 * @param context - 呼び出し情報などのコンテキスト
 * @returns フラット化されたkey-valueペアの配列
 *
 * @example
 * // { a: { b: 1, c: 2 } } → [{ key: "prefix.a.b", value: "1" }, { key: "prefix.a.c", value: "2" }]
 */
export function flattenObjectExpression(
  expression: Node,
  prefix: string,
  context: ResolveContext,
): FlattenedValue[] {
  if (!Node.isObjectLiteralExpression(expression)) {
    // オブジェクトリテラル以外の場合は単一の値として返す
    return [
      { key: prefix, value: resolveExpressionValue(expression, context) },
    ];
  }

  // 渡されたプロパティを収集
  const existingValues = flattenExistingProperties(expression, prefix, context);

  // 期待される型から省略されたプロパティを検出
  // ユニオン型（例: `{ a: number } | undefined`）からオブジェクト型を抽出
  const contextualType = expression.getContextualType();
  const objectType = contextualType ? extractObjectType(contextualType) : null;
  const missingValues = objectType
    ? getMissingProperties(expression, objectType, prefix)
    : [];

  return [...existingValues, ...missingValues];
}

/**
 * オブジェクトリテラル内の既存プロパティをフラット化する
 */
function flattenExistingProperties(
  expression: ObjectLiteralExpression,
  prefix: string,
  context: ResolveContext,
): FlattenedValue[] {
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

/**
 * 期待される型と比較して、省略されたプロパティを検出する
 *
 * 省略されたプロパティがオブジェクト型の場合、そのネストプロパティも
 * 再帰的に [undefined] として出力する。これにより、親プロパティが
 * 省略された場合でも、ネストプロパティが他の呼び出しと比較可能になる。
 *
 * @param objectExpression - オブジェクトリテラル
 * @param expectedType - 期待される型（コンテキスト型）
 * @param prefix - キー名のプレフィックス
 * @returns 省略されたプロパティの配列（値は [undefined]）
 */
function getMissingProperties(
  objectExpression: ObjectLiteralExpression,
  expectedType: Type,
  prefix: string,
): FlattenedValue[] {
  // 渡されたプロパティ名を収集
  const existingPropNames = new Set<string>();
  for (const property of objectExpression.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      existingPropNames.add(property.getName());
    } else if (Node.isShorthandPropertyAssignment(property)) {
      existingPropNames.add(property.getName());
    }
  }

  const missingValues: FlattenedValue[] = [];

  // 期待される型のプロパティを走査
  for (const propSymbol of expectedType.getProperties()) {
    const propName = propSymbol.getName();

    // 既に渡されているプロパティはスキップ
    if (existingPropNames.has(propName)) {
      continue;
    }

    const nestedPrefix = prefix ? `${prefix}.${propName}` : propName;

    // 省略されたプロパティを [undefined] として記録
    missingValues.push({
      key: nestedPrefix,
      value: UNDEFINED_VALUE,
    });

    // 省略されたプロパティがオブジェクト型の場合、ネストプロパティも再帰的に出力
    const propType = propSymbol.getValueDeclaration()?.getType();
    if (propType) {
      const objType = extractObjectType(propType);
      if (objType) {
        missingValues.push(
          ...getNestedMissingProperties(objType, nestedPrefix),
        );
      }
    }
  }

  return missingValues;
}

/**
 * 省略された親プロパティのネストプロパティを再帰的に [undefined] として出力
 */
function getNestedMissingProperties(
  parentType: Type,
  prefix: string,
): FlattenedValue[] {
  const result: FlattenedValue[] = [];

  for (const propSymbol of parentType.getProperties()) {
    const propName = propSymbol.getName();
    const nestedPrefix = `${prefix}.${propName}`;

    result.push({
      key: nestedPrefix,
      value: UNDEFINED_VALUE,
    });

    // さらにネストされたオブジェクト型があれば再帰
    const propType = propSymbol.getValueDeclaration()?.getType();
    if (propType) {
      const objType = extractObjectType(propType);
      if (objType) {
        result.push(...getNestedMissingProperties(objType, nestedPrefix));
      }
    }
  }

  return result;
}

/**
 * 型からオブジェクト部分を抽出する
 * ユニオン型（例: `{ a: number } | undefined`）から `undefined` を除外して
 * オブジェクト型部分を返す。オブジェクト型でない場合は null を返す。
 */
function extractObjectType(type: Type): Type | null {
  // ユニオン型の場合、undefined/null を除外したオブジェクト型を探す
  if (type.isUnion()) {
    for (const unionType of type.getUnionTypes()) {
      if (unionType.isUndefined() || unionType.isNull()) {
        continue;
      }
      const objType = extractObjectType(unionType);
      if (objType) {
        return objType;
      }
    }
    return null;
  }

  // プリミティブ型は除外
  if (
    type.isString() ||
    type.isNumber() ||
    type.isBoolean() ||
    type.isUndefined() ||
    type.isNull() ||
    type.isLiteral()
  ) {
    return null;
  }

  // 配列型は除外
  if (type.isArray()) {
    return null;
  }

  // オブジェクト型かつプロパティを持つ場合
  if (type.isObject() && type.getProperties().length > 0) {
    return type;
  }

  return null;
}
