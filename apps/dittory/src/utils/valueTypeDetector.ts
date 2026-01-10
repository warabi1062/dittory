import { UNDEFINED_VALUE } from "@/extraction/expressionResolver";

/**
 * フィルタリング対象の値種別
 */
export type ValueType = "boolean" | "number" | "string" | "enum" | "undefined";

/**
 * 有効な値種別の一覧
 */
export const VALID_VALUE_TYPES: readonly ValueType[] = [
  "boolean",
  "number",
  "string",
  "enum",
  "undefined",
];

/**
 * enum値の文字列表現パターン
 * 形式: "filePath:EnumName.MemberName=value"
 */
const ENUM_PATTERN = /^.+:\w+\.\w+=.+$/;

/**
 * 値の文字列表現から種別を判定する
 *
 * @param value - resolveExpressionValue で得られた値の文字列表現
 * @returns 検出された種別、または判定不能な場合は null
 */
export function detectValueType(value: string): ValueType | null {
  // boolean: "true" または "false"
  if (value === "true" || value === "false") {
    return "boolean";
  }

  // undefined: "[undefined]"
  if (value === UNDEFINED_VALUE) {
    return "undefined";
  }

  // enum: "filePath:EnumName.MemberName=value" 形式
  if (ENUM_PATTERN.test(value)) {
    return "enum";
  }

  // string: ダブルクォート囲み（JSON.stringify形式）
  if (value.startsWith('"') && value.endsWith('"')) {
    return "string";
  }

  // number: 数値として解釈可能
  // 空文字列は Number("") === 0 となるため除外
  if (value !== "" && !Number.isNaN(Number(value))) {
    return "number";
  }

  // 判定不能（function, paramRef, this, 変数参照など）
  return null;
}

/**
 * 値が指定された種別に含まれるか判定する
 *
 * @param value - resolveExpressionValue で得られた値の文字列表現
 * @param allowedTypes - 許可する種別の配列、または "all"
 * @returns 指定種別に含まれる場合は true
 */
export function matchesValueTypes(
  value: string,
  allowedTypes: ValueType[] | "all",
): boolean {
  if (allowedTypes === "all") {
    return true;
  }

  const detectedType = detectValueType(value);
  if (detectedType === null) {
    // 判定不能な値は種別指定時にはマッチしない
    return false;
  }

  return allowedTypes.includes(detectedType);
}
