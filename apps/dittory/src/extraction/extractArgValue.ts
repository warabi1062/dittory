import { Node, SyntaxKind } from "ts-morph";
import {
  type ArgValue,
  BooleanLiteralArgValue,
  EnumLiteralArgValue,
  FunctionArgValue,
  MethodCallLiteralArgValue,
  NumberLiteralArgValue,
  OtherLiteralArgValue,
  StringLiteralArgValue,
  ThisLiteralArgValue,
  UndefinedArgValue,
  VariableLiteralArgValue,
} from "./argValue";
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
 * @param expression - 解析対象の式ノード
 * @returns 式の値を表す ArgValue
 */
export function extractArgValue(expression: Node): ArgValue {
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
    const decl = symbol?.getDeclarations()[0];

    // enum memberの場合
    if (decl && Node.isEnumMember(decl)) {
      const enumDecl = decl.getParent();
      if (Node.isEnumDeclaration(enumDecl)) {
        return new EnumLiteralArgValue(
          enumDecl.getSourceFile().getFilePath(),
          enumDecl.getName(),
          decl.getName(),
          decl.getValue(),
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
    const decl = resolvedSymbol?.getDeclarations()[0];

    if (decl) {
      const kind = decl.getKind();
      // パラメータまたはBindingElementの場合
      if (kind === SyntaxKind.Parameter || kind === SyntaxKind.BindingElement) {
        return createParamRefValue(expression);
      }

      // 変数宣言の場合は初期化子を再帰的に解決
      if (Node.isVariableDeclaration(decl)) {
        const initializer = decl.getInitializer();
        if (initializer) {
          return extractArgValue(initializer);
        }
        return new VariableLiteralArgValue(
          decl.getSourceFile().getFilePath(),
          expression.getText(),
        );
      }

      // その他の宣言タイプ（インポート宣言など）
      // ファイルパス + 変数名で識別する
      return new VariableLiteralArgValue(
        decl.getSourceFile().getFilePath(),
        expression.getText(),
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

  // CallExpression (例: this.method(), obj.method())
  // プロパティアクセスを伴うメソッド呼び出しは、実行時に異なる値を返す可能性があるため、
  // 使用箇所ごとにユニークな値として扱う
  // 例: declSourceFile.getFilePath() はループ内で異なる declSourceFile に対して呼ばれる可能性がある
  if (Node.isCallExpression(expression)) {
    const calleeExpr = expression.getExpression();
    if (Node.isPropertyAccessExpression(calleeExpr)) {
      return new MethodCallLiteralArgValue(
        expression.getSourceFile().getFilePath(),
        expression.getStartLineNumber(),
        expression.getText(),
      );
    }
  }

  return new OtherLiteralArgValue(expression.getText());
}
