import {
  type ArgValue,
  BooleanLiteralArgValue,
  EnumLiteralArgValue,
  NumberLiteralArgValue,
  StringLiteralArgValue,
  UndefinedArgValue,
} from "@/domain/argValueClasses";

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
 * ArgValueから種別を判定する
 *
 * @param value - ArgValue インスタンス
 * @returns 検出された種別、または判定不能な場合は null
 */
function detectValueType(value: ArgValue): ValueType | null {
  if (value instanceof BooleanLiteralArgValue) {
    return "boolean";
  }

  if (value instanceof UndefinedArgValue) {
    return "undefined";
  }

  if (value instanceof EnumLiteralArgValue) {
    return "enum";
  }

  if (value instanceof StringLiteralArgValue) {
    return "string";
  }

  if (value instanceof NumberLiteralArgValue) {
    return "number";
  }

  // 判定不能（function, paramRef, this, 変数参照など）
  return null;
}

/**
 * 値が指定された種別に含まれるか判定する
 *
 * @param value - ArgValue インスタンス
 * @param allowedTypes - 許可する種別の配列、または "all"
 * @returns 指定種別に含まれる場合は true
 */
export function matchesValueTypes(
  value: ArgValue,
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
