import type { Type } from "ts-morph";

/**
 * 型からオブジェクト部分を抽出する
 * ユニオン型（例: `{ a: number } | undefined`）から `undefined` を除外して
 * オブジェクト型部分を返す。オブジェクト型でない場合は null を返す。
 */
export function extractObjectType(type: Type): Type | null {
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
