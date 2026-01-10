import type { Node } from "ts-morph";
import {
  type ArgValue,
  ArgValueType,
  type CallSiteMap,
  extractArgValue,
  getLiteralValue,
} from "./callSiteCollector";
import { argValueToKey, resolveParameterValue } from "./parameterUtils";

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
 * resolveExpressionValueのコンテキスト
 */
export interface ResolveContext {
  /** 呼び出し情報（パラメータ参照の解決に使用） */
  callSiteMap: CallSiteMap;
}

/**
 * 式の実際の値を解決する
 *
 * 異なるファイルで同じenum値やリテラル値を使用している場合でも、
 * 同一の値として認識できるよう、値を正規化して文字列表現で返す。
 * 同名だが異なる定義（別ファイルの同名enum等）を区別するため、
 * 必要に応じてファイルパスを含めた識別子を返す。
 *
 * @param expression - 解決対象の式
 * @param context - 呼び出し情報などのコンテキスト
 */
export function resolveExpressionValue(
  expression: Node,
  context: ResolveContext,
): string {
  const argValue = extractArgValue(expression);
  const sourceFile = expression.getSourceFile();
  const usageLocation = {
    filePath: sourceFile.getFilePath(),
    line: expression.getStartLineNumber(),
  };
  return argValueToString(argValue, context, usageLocation);
}

/**
 * 使用箇所の位置情報
 */
interface UsageLocation {
  filePath: string;
  line: number;
}

/**
 * ArgValue を文字列表現に変換する
 *
 * @param value - 変換対象の ArgValue
 * @param context - パラメータ参照解決用のコンテキスト
 * @param usageLocation - 使用箇所の位置情報（解決できないParamRefのユニーク化に使用）
 */
function argValueToString(
  value: ArgValue,
  context: ResolveContext,
  usageLocation: UsageLocation,
): string {
  switch (value.type) {
    case ArgValueType.Literal:
      return getLiteralValue(value);

    case ArgValueType.Function:
      // 関数型は使用箇所ごとにユニークな値として扱う
      return `${FUNCTION_VALUE_PREFIX}${value.filePath}:${value.line}`;

    case ArgValueType.ParamRef: {
      // パラメータ参照は callSiteMap を使って解決を試みる
      const resolved = resolveParameterValue(value, context.callSiteMap);
      if (resolved !== undefined) {
        return argValueToKey(resolved);
      }
      // 解決できない場合は使用箇所ごとにユニークな値として扱う
      // 使用箇所の位置情報を含めてユニークにする
      return `[paramRef]${usageLocation.filePath}:${usageLocation.line}:${argValueToKey(value)}`;
    }

    case ArgValueType.Undefined:
      return UNDEFINED_VALUE;
  }
}
