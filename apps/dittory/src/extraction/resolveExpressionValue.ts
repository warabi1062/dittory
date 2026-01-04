import { Node, SyntaxKind } from "ts-morph";
import type { CallSiteMap } from "./callSiteCollector";

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
 * パラメータ参照を表すプレフィックス
 */
export const PARAM_REF_PREFIX = "[param]";

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
  // 関数型の場合は定数として扱わない。
  // 同じ関数参照でも使用箇所ごとに異なる値として扱うことで、
  // コールバック関数が「常に同じ値」として誤検出されるのを防ぐ
  const type = expression.getType();
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return `${FUNCTION_VALUE_PREFIX}${sourceFile.getFilePath()}:${line}`;
  }

  // PropertyAccessExpression (例: Status.Active, props.number) の場合
  if (Node.isPropertyAccessExpression(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];

    // enum memberの場合は、同名enumの誤認識を防ぐためファイルパスを含める
    if (decl && Node.isEnumMember(decl)) {
      const enumDecl = decl.getParent();
      if (Node.isEnumDeclaration(enumDecl)) {
        const filePath = enumDecl.getSourceFile().getFilePath();
        const enumName = enumDecl.getName();
        const memberName = decl.getName();
        const value = decl.getValue();
        // 例: "/path/to/file.ts:Status.Active=0"
        return `${filePath}:${enumName}.${memberName}=${JSON.stringify(value)}`;
      }
    }

    // 左辺がパラメータを参照している場合（例: props.number）
    if (isParameterReference(expression.getExpression())) {
      // 呼び出し元で渡された値を解決
      const resolved = resolveParameterFromCallSites(
        expression,
        context.callSiteMap,
        new Set(),
      );
      if (resolved !== undefined) {
        return resolved;
      }
      // 解決できない場合は使用箇所ごとにユニークな値として扱う
      const sourceFile = expression.getSourceFile();
      const line = expression.getStartLineNumber();
      return `${PARAM_REF_PREFIX}${sourceFile.getFilePath()}:${line}`;
    }
  }

  // Identifier (変数参照) の場合
  // 変数の定義元を辿って実際の値を解決する
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return UNDEFINED_VALUE;
    }

    const symbol = expression.getSymbol();
    // インポートされた変数の場合、エイリアス先（元のエクスポート）のシンボルを取得する
    // これにより、異なるファイルから同じ変数をインポートした場合でも同一の値として認識される
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    const decl = resolvedSymbol?.getDeclarations()[0];

    if (decl && Node.isVariableDeclaration(decl)) {
      const initializer = decl.getInitializer();
      // 初期化子がある場合は再帰的に値を解決する
      // これにより、変数チェーン（const a = b; const b = 1;）も最終的な値まで辿れる
      // 初期化子がない場合は、ファイルパス + 変数名で一意に識別
      return initializer
        ? resolveExpressionValue(initializer, context)
        : `${decl.getSourceFile().getFilePath()}:${expression.getText()}`;
    }

    // パラメータや分割代入など、VariableDeclaration以外の宣言の場合
    // ファイルパス + 変数名で識別する
    if (decl) {
      return `${decl.getSourceFile().getFilePath()}:${expression.getText()}`;
    }
  }

  // リテラル型の場合は型情報から値を取得
  // JSON.stringifyで文字列と数値を区別できる形式にする（"foo" vs 42）
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return JSON.stringify(type.getLiteralValue());
  }

  // booleanリテラルの場合はgetLiteralValue()がundefinedを返すためgetText()を使用
  if (type.isBooleanLiteral()) {
    return type.getText();
  }

  // 上記のいずれにも該当しない場合（オブジェクト、配列、テンプレートリテラル等）
  // ソースコードのテキストをそのまま返す
  return expression.getText();
}

/**
 * 式がパラメータ（関数の引数）を参照しているかどうかを判定する
 * ネストしたプロパティアクセス（例: props.nested.value）にも対応
 */
function isParameterReference(expression: Node): boolean {
  if (Node.isIdentifier(expression)) {
    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];
    if (!decl) return false;
    // Parameter（通常の引数）またはBindingElement（分割代入パターン）の場合
    const kind = decl.getKind();
    return kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement;
  }
  // ネストしたPropertyAccessExpression（例: props.nested.value）の場合は再帰的にチェック
  if (Node.isPropertyAccessExpression(expression)) {
    return isParameterReference(expression.getExpression());
  }
  return false;
}

/**
 * パラメータ参照をCallSiteMapを使って解決する
 *
 * 例: ParentComponentA内の <ChildComponent number={props.number} />
 * → ParentComponentAのすべての呼び出し箇所で number に渡された値を収集
 * → すべて同じ値なら、その値を返す
 * → 異なる値があれば undefined を返す
 */
function resolveParameterFromCallSites(
  expression: Node,
  callSiteMap: CallSiteMap,
  visited: Set<string> = new Set(),
): string | undefined {
  // 関数スコープを特定
  const functionInfo = findContainingFunctionInfo(expression);
  if (!functionInfo) {
    return undefined;
  }

  const { filePath, functionName, propName } = functionInfo;
  const targetId = `${filePath}:${functionName}`;

  // 循環参照を防ぐ
  const visitKey = `${targetId}:${propName}`;
  if (visited.has(visitKey)) {
    return undefined;
  }
  visited.add(visitKey);

  const callSiteInfo = callSiteMap.get(targetId);
  if (!callSiteInfo) {
    return undefined;
  }

  // プロパティ名に対応する引数値を取得
  const args = callSiteInfo.get(propName);
  if (!args || args.length === 0) {
    return undefined;
  }

  // すべての呼び出し箇所で渡された値を収集・解決
  const resolvedValues = new Set<string>();

  for (const arg of args) {
    const value = arg.value;

    // パラメータ参照は再帰的に解決
    if (value.startsWith(PARAM_REF_PREFIX)) {
      // [param]ファイルパス:関数名:パラメータパス 形式を解析
      const paramContent = value.substring(PARAM_REF_PREFIX.length);
      const parts = paramContent.split(":");

      if (parts.length >= 3) {
        // 上で parts.length >= 3 を検証済みなので必ず値が存在する
        const paramPath = parts[parts.length - 1];
        const parentFuncName = parts[parts.length - 2];
        const parentFilePath = parts.slice(0, -2).join(":");
        const parentTargetId = `${parentFilePath}:${parentFuncName}`;

        // 親の呼び出し情報から値を取得
        const parentInfo = callSiteMap.get(parentTargetId);
        if (parentInfo) {
          // プロパティパスの最後の部分を取得（props.number → number）
          const propParts = paramPath.split(".");
          const lastProp = propParts[propParts.length - 1];
          const parentArgs = parentInfo.get(lastProp);

          if (parentArgs && parentArgs.length > 0) {
            for (const parentArg of parentArgs) {
              let parentValue = parentArg.value;
              // 再帰的に解決
              if (parentValue.startsWith(PARAM_REF_PREFIX)) {
                const resolved = resolveParamRefRecursive(
                  parentValue,
                  callSiteMap,
                  new Set(visited),
                );
                if (resolved === undefined) {
                  return undefined;
                }
                parentValue = resolved;
              }
              resolvedValues.add(parentValue);
            }
            continue;
          }
        }
      }
      // 解決できない場合
      return undefined;
    }

    resolvedValues.add(value);
  }

  // すべて同じ値なら、その値を返す
  if (resolvedValues.size === 1) {
    return [...resolvedValues][0];
  }

  // 異なる値がある場合は解決できない
  return undefined;
}

/**
 * パラメータ参照を再帰的に解決する
 */
function resolveParamRefRecursive(
  paramRef: string,
  callSiteMap: CallSiteMap,
  visited: Set<string>,
): string | undefined {
  if (!paramRef.startsWith(PARAM_REF_PREFIX)) {
    return paramRef;
  }

  const paramContent = paramRef.substring(PARAM_REF_PREFIX.length);
  const parts = paramContent.split(":");

  if (parts.length >= 3) {
    // 上で parts.length >= 3 を検証済みなので必ず値が存在する
    const paramPath = parts[parts.length - 1];
    const funcName = parts[parts.length - 2];
    const filePath = parts.slice(0, -2).join(":");
    const targetId = `${filePath}:${funcName}`;

    const visitKey = `${targetId}:${paramPath}`;
    if (visited.has(visitKey)) {
      return undefined;
    }
    visited.add(visitKey);

    const callSiteInfo = callSiteMap.get(targetId);
    if (!callSiteInfo) {
      return undefined;
    }

    // プロパティパスの最後の部分を取得
    const propParts = paramPath.split(".");
    const lastProp = propParts[propParts.length - 1];
    const args = callSiteInfo.get(lastProp);

    if (!args || args.length === 0) {
      return undefined;
    }

    const resolvedValues = new Set<string>();
    for (const arg of args) {
      let value = arg.value;
      if (value.startsWith(PARAM_REF_PREFIX)) {
        const resolved = resolveParamRefRecursive(
          value,
          callSiteMap,
          new Set(visited),
        );
        if (resolved === undefined) {
          return undefined;
        }
        value = resolved;
      }
      resolvedValues.add(value);
    }

    if (resolvedValues.size === 1) {
      return [...resolvedValues][0];
    }
  }

  return undefined;
}

/**
 * 式を含む関数の情報を取得する
 */
function findContainingFunctionInfo(
  node: Node,
): { filePath: string; functionName: string; propName: string } | undefined {
  const sourceFile = node.getSourceFile();
  const filePath = sourceFile.getFilePath();

  // プロパティ名を取得（props.number → number）
  let propName: string;
  if (Node.isPropertyAccessExpression(node)) {
    propName = node.getName();
  } else {
    return undefined;
  }

  // 関数スコープを見つける
  let current: Node | undefined = node;
  while (current) {
    if (Node.isFunctionDeclaration(current)) {
      const name = current.getName();
      if (name) {
        return { filePath, functionName: name, propName };
      }
    }
    if (Node.isArrowFunction(current) || Node.isFunctionExpression(current)) {
      const parent = current.getParent();
      if (parent && Node.isVariableDeclaration(parent)) {
        return { filePath, functionName: parent.getName(), propName };
      }
    }
    if (Node.isMethodDeclaration(current)) {
      const classDecl = current
        .getParent()
        ?.asKind(SyntaxKind.ClassDeclaration);
      const className = classDecl?.getName();
      const methodName = current.getName();
      const fullName = className ? `${className}.${methodName}` : methodName;
      return { filePath, functionName: fullName, propName };
    }
    current = current.getParent();
  }

  return undefined;
}
