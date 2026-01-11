import { type ArgValue, ParamRefArgValue } from "./argValueClasses";
import { type CallSiteArg, CallSiteInfo } from "./callSiteInfo";

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
   * 引数情報をCallSiteInfoに追加する
   */
  addArg(targetId: string, arg: CallSiteArg): void {
    const info = this.getOrCreateInfo(targetId);
    info.addArg(arg.name, arg);
  }

  /**
   * パラメータ参照を解決してArgValueを返す
   * callSiteMapを使ってパラメータに渡されたすべての値を取得し、
   * すべて同じ値ならその値を返す。解決できない場合は元のParamRefArgValueを返す。
   */
  resolveParamRef(paramRef: ParamRefArgValue): ArgValue {
    const resolved = this.resolveParameterValueInternal(paramRef);
    if (resolved !== undefined) {
      return resolved;
    }
    // 解決できない場合は元のParamRefArgValueを返す
    return paramRef;
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
    const key = paramRef.toKey();
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

      const resolvedKey = resolved.toKey();
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

  /**
   * targetIdに対応する呼び出し情報を取得する
   * 存在しない場合は新規作成して登録する
   */
  private getOrCreateInfo(targetId: string): CallSiteInfo {
    let info = this.map.get(targetId);
    if (!info) {
      info = new CallSiteInfo();
      this.map.set(targetId, info);
    }
    return info;
  }
}
