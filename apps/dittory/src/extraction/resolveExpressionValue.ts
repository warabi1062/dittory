import type { Node } from "ts-morph";
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

  // パラメータ参照は callSiteMap を使って解決
  if (argValue instanceof ParamRefArgValue) {
    return context.callSiteMap.resolveParamRef(argValue);
  }

  // その他（Literal, Function, Undefined）は getValue() で文字列表現を取得
  return argValue.getValue();
}
