// ============================================================================
// ArgValue クラス階層
// ============================================================================

/**
 * 引数の値を表す基底抽象クラス
 */
export abstract class ArgValue {
  /**
   * 比較用の文字列値を取得する
   */
  abstract getValue(): string;
}

/**
 * リテラル値の基底抽象クラス
 */
export abstract class LiteralArgValue extends ArgValue {}

/**
 * enum メンバーのリテラル値
 */
export class EnumLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly enumName: string,
    readonly memberName: string,
    readonly enumValue: string | number | undefined,
  ) {
    super();
  }

  getValue(): string {
    return `${this.filePath}:${this.enumName}.${this.memberName}=${JSON.stringify(this.enumValue)}`;
  }
}

/**
 * this プロパティアクセスのリテラル値
 */
export class ThisLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
    readonly expression: string,
  ) {
    super();
  }

  getValue(): string {
    return `[this]${this.filePath}:${this.line}:${this.expression}`;
  }
}

/**
 * メソッド呼び出しのリテラル値
 */
export class MethodCallLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
    readonly expression: string,
  ) {
    super();
  }

  getValue(): string {
    return `[methodCall]${this.filePath}:${this.line}:${this.expression}`;
  }
}

/**
 * 変数参照のリテラル値
 */
export class VariableLiteralArgValue extends LiteralArgValue {
  constructor(
    readonly filePath: string,
    readonly identifier: string,
  ) {
    super();
  }

  getValue(): string {
    return `${this.filePath}:${this.identifier}`;
  }
}

/**
 * boolean リテラル値
 */
export class BooleanLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: boolean) {
    super();
  }

  getValue(): string {
    return String(this.value);
  }
}

/**
 * 文字列リテラル値
 */
export class StringLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: string) {
    super();
  }

  getValue(): string {
    return JSON.stringify(this.value);
  }
}

/**
 * 数値リテラル値
 */
export class NumberLiteralArgValue extends LiteralArgValue {
  constructor(readonly value: number) {
    super();
  }

  getValue(): string {
    return JSON.stringify(this.value);
  }
}

/**
 * JSX boolean shorthand のリテラル値
 */
export class JsxShorthandLiteralArgValue extends LiteralArgValue {
  getValue(): string {
    return "true";
  }
}

/**
 * その他のリテラル値（フォールバック）
 */
export class OtherLiteralArgValue extends LiteralArgValue {
  constructor(readonly expression: string) {
    super();
  }

  getValue(): string {
    return this.expression;
  }
}

/**
 * 関数型の値
 */
export class FunctionArgValue extends ArgValue {
  constructor(
    readonly filePath: string,
    readonly line: number,
  ) {
    super();
  }

  getValue(): string {
    return `[function]${this.filePath}:${this.line}`;
  }
}

/**
 * パラメータ参照の値
 */
export class ParamRefArgValue extends ArgValue {
  constructor(
    readonly filePath: string,
    readonly functionName: string,
    readonly path: string,
    readonly line: number,
  ) {
    super();
  }

  getValue(): string {
    return `paramRef:${this.filePath}:${this.functionName}:${this.path}`;
  }
}

/**
 * undefined の値
 */
export class UndefinedArgValue extends ArgValue {
  getValue(): string {
    return "[undefined]";
  }
}

// ============================================================================
// 呼び出し情報の型定義
// ============================================================================

/**
 * 呼び出し箇所での引数情報
 */
export interface CallSiteArg {
  /** 引数のインデックス（0始まり）またはプロパティ名 */
  name: string;
  /** 引数の値 */
  value: ArgValue;
  /** 呼び出し元ファイルパス */
  filePath: string;
  /** 呼び出し元行番号 */
  line: number;
}

/**
 * 関数/コンポーネントへの呼び出し情報
 * key: パラメータ名, value: 渡された値の配列
 */
export type CallSiteInfo = Map<string, CallSiteArg[]>;

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * ArgValue を比較可能な文字列キーに変換
 * 同じ値かどうかの判定に使用
 */
export function argValueToKey(value: ArgValue): string {
  // リテラル値は literal: プレフィックスを付けて区別する
  if (value instanceof LiteralArgValue) {
    return `literal:${value.getValue()}`;
  }
  return value.getValue();
}
