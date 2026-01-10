import {
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
} from "ts-morph";
import {
  type ArgValue,
  argValueToKey,
  type CallSiteInfo,
  JsxShorthandLiteralArgValue,
  OtherLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
  UndefinedArgValue,
} from "./argValue";
import { extractArgValue } from "./extractArgValue";

/**
 * すべての関数/コンポーネントの呼び出し情報を管理するクラス
 */
export class CallSiteMap {
  private map: Map<string, CallSiteInfo>;

  constructor(initialMap?: Map<string, CallSiteInfo>) {
    this.map = initialMap ?? new Map();
  }

  /**
   * 指定されたtargetIdの呼び出し情報を取得する
   */
  get(targetId: string): CallSiteInfo | undefined {
    return this.map.get(targetId);
  }

  /**
   * JSX要素から呼び出し情報を抽出して登録する
   */
  extractFromJsxElement(
    element: JsxOpeningElement | JsxSelfClosingElement,
    targetId: string,
  ): void {
    const sourceFile = element.getSourceFile();
    const filePath = sourceFile.getFilePath();

    let info = this.map.get(targetId);
    if (!info) {
      info = new Map();
      this.map.set(targetId, info);
    }

    for (const attr of element.getAttributes()) {
      if (!Node.isJsxAttribute(attr)) continue;

      const propName = attr.getNameNode().getText();
      const initializer = attr.getInitializer();

      let value: ArgValue;
      if (!initializer) {
        // boolean shorthand
        value = new JsxShorthandLiteralArgValue();
      } else if (Node.isJsxExpression(initializer)) {
        const expr = initializer.getExpression();
        value = expr ? extractArgValue(expr) : new UndefinedArgValue();
      } else if (Node.isStringLiteral(initializer)) {
        // JSX属性の文字列値 (例: value="hello")
        // getLiteralValue()で引用符なしの値を取得
        value = new StringLiteralArgValue(initializer.getLiteralValue());
      } else {
        value = new OtherLiteralArgValue(initializer.getText());
      }

      const args = info.get(propName) ?? [];
      args.push({
        name: propName,
        value,
        filePath,
        line: element.getStartLineNumber(),
      });
      info.set(propName, args);
    }
  }

  /**
   * 関数呼び出しから呼び出し情報を抽出して登録する
   */
  extractFromCallExpression(
    callExpr: CallExpression,
    targetId: string,
    paramNames: string[],
  ): void {
    const sourceFile = callExpr.getSourceFile();
    const filePath = sourceFile.getFilePath();

    let info = this.map.get(targetId);
    if (!info) {
      info = new Map();
      this.map.set(targetId, info);
    }

    const args = callExpr.getArguments();
    for (let i = 0; i < paramNames.length; i++) {
      const paramName = paramNames[i];
      const arg = args[i];
      const value: ArgValue = arg
        ? extractArgValue(arg)
        : new UndefinedArgValue();

      const argList = info.get(paramName) ?? [];
      argList.push({
        name: paramName,
        value,
        filePath,
        line: callExpr.getStartLineNumber(),
      });
      info.set(paramName, argList);
    }
  }

  /**
   * パラメータ参照を解決して文字列表現を返す
   * callSiteMapを使ってパラメータに渡されたすべての値を取得し、
   * すべて同じ値ならその値を返す。解決できない場合は使用箇所ごとにユニークな値を返す。
   */
  resolveParamRef(paramRef: ParamRefArgValue): string {
    const resolved = this.resolveParameterValueInternal(paramRef);
    if (resolved !== undefined) {
      return argValueToKey(resolved);
    }
    // 解決できない場合は使用箇所ごとにユニークな値として扱う
    return `[paramRef]${paramRef.filePath}:${paramRef.line}:${paramRef.getValue()}`;
  }

  /**
   * パラメータ参照を解決する（内部メソッド）
   * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
   * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
   */
  private resolveParameterValueInternal(
    paramRef: ParamRefArgValue,
    visited: Set<string> = new Set(),
  ): ArgValue | undefined {
    // 循環参照を防ぐ
    const key = argValueToKey(paramRef);
    if (visited.has(key)) {
      return undefined;
    }
    visited.add(key);

    const { filePath, functionName, path } = paramRef;
    const targetId = `${filePath}:${functionName}`;
    const callSiteInfo = this.map.get(targetId);

    if (!callSiteInfo) {
      return undefined;
    }

    // パラメータパスからプロパティ名を抽出
    // 例: "props.number" → "number", "a" → "a"
    const paramParts = path.split(".");
    // JSXの場合は props.xxx 形式なので最後のプロパティ名を使用
    // 通常関数の場合は最初の名前がそのまま引数名
    const propName =
      paramParts.length > 1 ? paramParts[paramParts.length - 1] : paramParts[0];

    const args = callSiteInfo.get(propName);
    if (!args || args.length === 0) {
      return undefined;
    }

    // すべての呼び出し箇所で渡された値を収集
    const resolvedKeys = new Set<string>();
    let resolvedValue: ArgValue | undefined;

    for (const arg of args) {
      // 再帰的にパラメータ参照を解決
      let resolved: ArgValue | undefined;
      if (arg.value instanceof ParamRefArgValue) {
        resolved = this.resolveParameterValueInternal(
          arg.value,
          new Set(visited),
        );
      } else {
        resolved = arg.value;
      }

      if (resolved === undefined) {
        return undefined;
      }

      const resolvedKey = argValueToKey(resolved);
      resolvedKeys.add(resolvedKey);
      resolvedValue = resolved;
    }

    // すべて同じ値なら、その値を返す
    if (resolvedKeys.size === 1) {
      return resolvedValue;
    }

    // 異なる値がある場合は解決不可
    return undefined;
  }
}
