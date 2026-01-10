// ============================================================================
// ArgValue クラス階層
// ============================================================================

/**
 * 引数の値を表す基底抽象クラス
 */
export abstract class ArgValue {
  /**
   * 生の値を取得する（プレフィックスなし）
   */
  abstract getValue(): string;

  /**
   * 値のプレフィックス（空文字の場合はプレフィックスなし）
   */
  protected abstract readonly prefix: string;

  /**
   * outputString() でプレフィックスを含めるかどうか
   * - true: プレフィックスを含める（関数、パラメータ参照など）
   * - false: 値のみ（リテラル値）
   */
  protected abstract readonly includePrefixInOutput: boolean;

  /**
   * 比較可能な文字列キーに変換する
   * 同じ値かどうかの判定に使用
   */
  toKey(): string {
    return `[${this.prefix}]${this.getValue()}`;
  }

  /**
   * 出力用の文字列表現を取得する
   */
  outputString(): string {
    if (this.includePrefixInOutput) {
      return `[${this.prefix}]${this.getValue()}`;
    }
    return this.getValue();
  }
}

/**
 * リテラル値の基底抽象クラス
 * 出力時はプレフィックスなし、比較キーには [literal] プレフィックスを付ける
 */
export abstract class LiteralArgValue extends ArgValue {
  protected override readonly prefix: string = "literal";
  protected override readonly includePrefixInOutput: boolean = false;
}

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
    return `${this.filePath}:${this.enumName}.${
      this.memberName
    }=${JSON.stringify(this.enumValue)}`;
  }

  override outputString(): string {
    return `${this.enumName}.${this.memberName}`;
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

  protected override readonly prefix = "this";
  protected override readonly includePrefixInOutput = true;

  getValue(): string {
    return `${this.filePath}:${this.line}:${this.expression}`;
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

  protected override readonly prefix = "methodCall";
  protected override readonly includePrefixInOutput = true;

  getValue(): string {
    return `${this.filePath}:${this.line}:${this.expression}`;
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

  protected override readonly prefix = "function";
  protected override readonly includePrefixInOutput = true;

  getValue(): string {
    return `${this.filePath}:${this.line}`;
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

  protected override readonly prefix = "paramRef";
  protected override readonly includePrefixInOutput = true;

  getValue(): string {
    return `${this.filePath}:${this.functionName}:${this.path}`;
  }
}

/**
 * undefined の値
 */
export class UndefinedArgValue extends ArgValue {
  protected override readonly prefix = "undefined";
  protected override readonly includePrefixInOutput = true;

  getValue(): string {
    return "";
  }
}
