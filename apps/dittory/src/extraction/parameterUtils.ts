import {
  type ArgValue,
  ArgValueType,
  type CallSiteMap,
} from "./callSiteCollector";

/**
 * ArgValue を比較可能な文字列キーに変換
 * 同じ値かどうかの判定に使用
 */
export function argValueToKey(value: ArgValue): string {
  switch (value.type) {
    case ArgValueType.Literal:
      return `literal:${value.value}`;
    case ArgValueType.Function:
      return `function:${value.filePath}:${value.line}`;
    case ArgValueType.ParamRef:
      return `paramRef:${value.filePath}:${value.functionName}:${value.path}`;
    case ArgValueType.Undefined:
      return "undefined";
  }
}

/**
 * パラメータ参照を解決する
 * callSiteMapを使って、パラメータに渡されたすべての値を取得し、
 * すべて同じ値ならその値を返す。異なる値があればundefinedを返す。
 *
 * @param argValue - 解決対象の ArgValue
 * @param callSiteMap - 呼び出し情報マップ
 * @param visited - 循環参照防止用のセット
 * @returns 解決された ArgValue。異なる値がある場合や解決できない場合はundefined
 */
export function resolveParameterValue(
  argValue: ArgValue,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
): ArgValue | undefined {
  // パラメータ参照でない場合はそのまま返す
  if (argValue.type !== ArgValueType.ParamRef) {
    return argValue;
  }

  // 循環参照を防ぐ
  const key = argValueToKey(argValue);
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);

  const { filePath, functionName, path } = argValue;
  const targetId = `${filePath}:${functionName}`;
  const callSiteInfo = callSiteMap.get(targetId);

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
    const resolved = resolveParameterValue(
      arg.value,
      callSiteMap,
      new Set(visited),
    );
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
