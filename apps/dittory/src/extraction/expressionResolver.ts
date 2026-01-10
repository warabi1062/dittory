import { Node, type ObjectLiteralExpression, type Type } from "ts-morph";
import { ParamRefArgValue } from "./argValue";
import type { CallSiteMap } from "./callSiteMap";
import { extractArgValue } from "./extractArgValue";

/**
 * 引数が渡されなかった場合を表す特別な値
 * 必須/任意を問わず、引数未指定の使用箇所を統一的に扱うために使用
 *
 * 注意: この値は文字列 "[undefined]" であり、JavaScriptの undefined とは異なる。
 * 解決関数が undefined を返す場合は「値を解決できなかった」ことを意味し、
 * この文字列を返す場合は「実際に undefined が渡された」ことを意味する。
 */
export const UNDEFINED_VALUE = "[undefined]";

/**
 * 関数型の値を表すプレフィックス
 * コールバック関数など、関数が渡された場合は使用箇所ごとにユニークな値として扱う
 * これにより、同じコールバック関数を渡していても「定数」として検出されない
 */
export const FUNCTION_VALUE_PREFIX = "[function]";

/**
 * フラット化された値
 */
export type FlattenedValue = { key: string; value: string };

/**
 * 式の値を解決するクラス
 * CallSiteMap を使ってパラメータ参照を解決し、式の値を文字列表現に変換する
 */
export class ExpressionResolver {
  constructor(private callSiteMap: CallSiteMap) {}

  /**
   * 式の実際の値を解決する
   *
   * 異なるファイルで同じenum値やリテラル値を使用している場合でも、
   * 同一の値として認識できるよう、値を正規化して文字列表現で返す。
   * 同名だが異なる定義（別ファイルの同名enum等）を区別するため、
   * 必要に応じてファイルパスを含めた識別子を返す。
   */
  resolve(expression: Node): string {
    const argValue = extractArgValue(expression);

    // パラメータ参照は callSiteMap を使って解決
    if (argValue instanceof ParamRefArgValue) {
      return this.callSiteMap.resolveParamRef(argValue);
    }

    // その他（Literal, Function, Undefined）は getValue() で文字列表現を取得
    return argValue.getValue();
  }

  /**
   * オブジェクトリテラルを再帰的に解析し、フラットなkey-valueペアを返す
   *
   * 期待される型（コンテキスト型）から省略されたプロパティも検出し、
   * [undefined] として記録する。
   *
   * @param expression - 解析対象の式ノード
   * @param prefix - キー名のプレフィックス（ネストしたプロパティの親パスを表す）
   * @returns フラット化されたkey-valueペアの配列
   *
   * @example
   * // { a: { b: 1, c: 2 } } → [{ key: "prefix.a.b", value: "1" }, { key: "prefix.a.c", value: "2" }]
   */
  flattenObject(expression: Node, prefix: string): FlattenedValue[] {
    if (!Node.isObjectLiteralExpression(expression)) {
      // オブジェクトリテラル以外の場合は単一の値として返す
      return [{ key: prefix, value: this.resolve(expression) }];
    }

    // 渡されたプロパティを収集
    const existingValues = this.flattenExistingProperties(expression, prefix);

    // 期待される型から省略されたプロパティを検出
    // ユニオン型（例: `{ a: number } | undefined`）からオブジェクト型を抽出
    const contextualType = expression.getContextualType();
    const objectType = contextualType
      ? extractObjectType(contextualType)
      : null;
    const missingValues = objectType
      ? getMissingProperties(expression, objectType, prefix)
      : [];

    return [...existingValues, ...missingValues];
  }

  /**
   * オブジェクトリテラル内の既存プロパティをフラット化する
   */
  private flattenExistingProperties(
    expression: ObjectLiteralExpression,
    prefix: string,
  ): FlattenedValue[] {
    return expression.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property)) {
        const propertyName = property.getName();
        const nestedPrefix = prefix
          ? `${prefix}.${propertyName}`
          : propertyName;
        const initializer = property.getInitializer();

        return initializer ? this.flattenObject(initializer, nestedPrefix) : [];
      }

      if (Node.isShorthandPropertyAssignment(property)) {
        // { foo } のような省略形
        const propertyName = property.getName();
        const nestedPrefix = prefix
          ? `${prefix}.${propertyName}`
          : propertyName;
        return [
          {
            key: nestedPrefix,
            value: this.resolve(property.getNameNode()),
          },
        ];
      }

      return [];
    });
  }
}

/**
 * 期待される型と比較して、省略されたプロパティを検出する
 *
 * 省略されたプロパティがオブジェクト型の場合、そのネストプロパティも
 * 再帰的に [undefined] として出力する。これにより、親プロパティが
 * 省略された場合でも、ネストプロパティが他の呼び出しと比較可能になる。
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
