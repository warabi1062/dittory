import { Node } from "ts-morph";

/**
 * 引数が渡されなかった場合を表す特別な値
 * 必須/任意を問わず、引数未指定の使用箇所を統一的に扱うために使用
 */
export const UNDEFINED_VALUE = "undefined";

/**
 * 関数型の値を表すプレフィックス
 * コールバック関数など、関数が渡された場合は使用箇所ごとにユニークな値として扱う
 * これにより、同じコールバック関数を渡していても「定数」として検出されない
 */
export const FUNCTION_VALUE_PREFIX = "[function]";

/**
 * 式の実際の値を解決する
 *
 * 異なるファイルで同じenum値やリテラル値を使用している場合でも、
 * 同一の値として認識できるよう、値を正規化して文字列表現で返す。
 * 同名だが異なる定義（別ファイルの同名enum等）を区別するため、
 * 必要に応じてファイルパスを含めた識別子を返す。
 */
export function resolveExpressionValue(expression: Node): string {
  // 関数型の場合は定数として扱わない。
  // 同じ関数参照でも使用箇所ごとに異なる値として扱うことで、
  // コールバック関数が「常に同じ値」として誤検出されるのを防ぐ
  const type = expression.getType();
  if (type.getCallSignatures().length > 0) {
    const sourceFile = expression.getSourceFile();
    const line = expression.getStartLineNumber();
    return `${FUNCTION_VALUE_PREFIX}${sourceFile.getFilePath()}:${line}`;
  }

  // PropertyAccessExpression (例: Status.Active) の場合
  // enum参照を正確に識別するために、ファイルパスを含めた完全修飾名を返す
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
  }

  // Identifier (変数参照) の場合
  // 変数の定義元を辿って実際の値を解決する
  if (Node.isIdentifier(expression)) {
    if (expression.getText() === "undefined") {
      return UNDEFINED_VALUE;
    }

    const symbol = expression.getSymbol();
    const decl = symbol?.getDeclarations()[0];

    if (decl && Node.isVariableDeclaration(decl)) {
      const initializer = decl.getInitializer();
      // 初期化子がある場合はその値を使用（空白は正規化して比較しやすくする）
      // 初期化子がない場合は、ファイルパス + 変数名で一意に識別
      return initializer
        ? initializer.getText().replace(/\s+/g, " ")
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
