import { Node, SyntaxKind } from "ts-morph";
import {
  type ArgValue,
  BooleanLiteralArgValue,
  EnumLiteralArgValue,
  FunctionArgValue,
  JsxShorthandLiteralArgValue,
  MethodCallLiteralArgValue,
  NumberLiteralArgValue,
  OtherLiteralArgValue,
  StringLiteralArgValue,
  ThisLiteralArgValue,
  UndefinedArgValue,
  VariableLiteralArgValue,
} from "@/domain/argValueClasses";
import { createParamRefValue, isParameterReference } from "./parameterUtils";

/**
 * 式がthisキーワードへのプロパティアクセスかどうかを判定する
 * ネストしたアクセス（例: this.logger.name）にも対応
 */
function isThisPropertyAccess(expression: Node): boolean {
  if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    if (baseExpr.getKind() === SyntaxKind.ThisKeyword) {
      return true;
    }
    return isThisPropertyAccess(baseExpr);
  }
  return false;
}

/**
 * 式から ArgValue を抽出する
 *
 * 式の値を型安全な ArgValue として返す。
 * 呼び出し情報収集時および式の値解決時に使用する。
 *
 * @param expression - 解析対象の式ノード（undefinedの場合はUndefinedArgValueを返す）
 * @returns 式の値を表す ArgValue
 */
export function extractArgValue(expression: Node | undefined): ArgValue {
  if (!expression) {
    return new UndefinedArgValue();
  }

  // JsxAttribute の場合（例: <Button disabled /> や <Button label="hello" />）
  if (Node.isJsxAttribute(expression)) {
    const initializer = expression.getInitializer();
    if (!initializer) {
      // boolean shorthand（例: <Button disabled />）
      return new JsxShorthandLiteralArgValue();
    }
    if (Node.isJsxExpression(initializer)) {
      // JSX式（例: <Button onClick={handleClick} />）
      return extractArgValue(initializer.getExpression());
    }
    if (Node.isStringLiteral(initializer)) {
      // 文字列値（例: <Button label="hello" />）
      return new StringLiteralArgValue(initializer.getLiteralValue());
    }
    return new OtherLiteralArgValue(initializer.getText());
  }

  const type = expression.getType();

  // 関数型の場合
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return new FunctionArgValue(sourceFile.getFilePath(), line);
  }

  // PropertyAccessExpression (例: Status.Active, props.number)
  if (Node.isPropertyAccessExpression(expression)) {
    const symbol = expression.getSymbol();
    const declaration = symbol?.getDeclarations()[0];

    // enum memberの場合
    if (declaration && Node.isEnumMember(declaration)) {
      const enumDeclaration = declaration.getParent();
      if (Node.isEnumDeclaration(enumDeclaration)) {
        return new EnumLiteralArgValue(
          enumDeclaration.getSourceFile().getFilePath(),
          enumDeclaration.getName(),
          declaration.getName(),
          declaration.getValue(),
        );
      }
    }

    // パラメータのプロパティアクセスの場合
    if (isParameterReference(expression.getExpression())) {
      return createParamRefValue(expression);
    }

    // thisキーワードへのプロパティアクセスの場合
    // クラスメンバーは実行時にインスタンスごとに異なる値を持つ可能性があるため、
    // 使用箇所ごとにユニークな値として扱う
    if (isThisPropertyAccess(expression)) {
      return new ThisLiteralArgValue(
        expression.getSourceFile().getFilePath(),
        expression.getStartLineNumber(),
        expression.getText(),
      );
    }
  }

  // Identifier (変数参照)
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return new UndefinedArgValue();
    }

    const symbol = expression.getSymbol();
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    const declaration = resolvedSymbol?.getDeclarations()[0];

    if (declaration) {
      let actualDeclaration: Node = declaration;
      let kind = declaration.getKind();

      // ShorthandPropertyAssignment の場合、実際の参照先を解決する
      // 例: { name } という短縮プロパティで、name が for...of の分割代入から来ている場合、
      // シンボルの宣言は ShorthandPropertyAssignment 自体になるが、
      // 実際には BindingElement や Parameter や VariableDeclaration を参照している
      if (kind === SyntaxKind.ShorthandPropertyAssignment) {
        const definitions = expression.getDefinitions();
        for (const def of definitions) {
          const node = def.getDeclarationNode();
          if (!node) continue;
          const k = node.getKind();
          if (
            k === SyntaxKind.BindingElement ||
            k === SyntaxKind.Parameter ||
            k === SyntaxKind.VariableDeclaration
          ) {
            actualDeclaration = node;
            kind = k;
            break;
          }
        }
      }

      // パラメータまたはBindingElementの場合
      if (kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement) {
        return createParamRefValue(expression);
      }

      // 変数宣言の場合は初期化子を再帰的に解決
      if (Node.isVariableDeclaration(actualDeclaration)) {
        const initializer = actualDeclaration.getInitializer();
        if (initializer) {
          return extractArgValue(initializer);
        }
        return new VariableLiteralArgValue(
          actualDeclaration.getSourceFile().getFilePath(),
          expression.getText(),
          actualDeclaration.getStartLineNumber(),
        );
      }

      // その他の宣言タイプ（インポート宣言など）
      // ファイルパス + 宣言行番号 + 変数名で識別する
      return new VariableLiteralArgValue(
        actualDeclaration.getSourceFile().getFilePath(),
        expression.getText(),
        actualDeclaration.getStartLineNumber(),
      );
    }
  }

  // リテラル型
  const literalValue = type.getLiteralValue();
  if (type.isStringLiteral() && typeof literalValue === "string") {
    return new StringLiteralArgValue(literalValue);
  }

  if (type.isNumberLiteral() && typeof literalValue === "number") {
    return new NumberLiteralArgValue(literalValue);
  }

  if (type.isBooleanLiteral()) {
    return new BooleanLiteralArgValue(type.getText() === "true");
  }

  // CallExpression (例: this.method(), obj.method(), func(arg))
  // 以下の場合は実行時に異なる値を返す可能性があるため、使用箇所ごとにユニークな値として扱う：
  // 1. プロパティアクセスを伴うメソッド呼び出し（例: declSourceFile.getFilePath()）
  // 2. 引数にパラメータ参照が含まれる関数呼び出し（例: extractArgValue(node)）
  if (Node.isCallExpression(expression)) {
    const calleeExpr = expression.getExpression();
    const hasParamRefArg = expression
      .getArguments()
      .some((arg) => isParameterReference(arg));

    if (Node.isPropertyAccessExpression(calleeExpr) || hasParamRefArg) {
      return new MethodCallLiteralArgValue(
        expression.getSourceFile().getFilePath(),
        expression.getStartLineNumber(),
        expression.getText(),
      );
    }
  }

  return new OtherLiteralArgValue(expression.getText());
}
