import { Node, type Type } from "ts-morph";
import type { Definition } from "@/domain/usagesByParam";

/**
 * コンポーネントのprops定義を取得する
 *
 * 関数の第一パラメータの型情報からpropsを抽出する。
 * 「Props」などの命名規則に依存せず、TypeScriptの型システムから直接取得するため、
 * どのような命名でもpropsを正確に取得できる。
 *
 * 対応パターン:
 * - function Component(props: Props)
 * - const Component = (props: Props) => ...
 * - React.forwardRef((props, ref) => ...)
 * - React.memo((props) => ...)
 */
export function getProps(declaration: Node): Definition[] {
  // 関数宣言、アロー関数、関数式から第一パラメータ（props）を取得
  let propsParam: Node | undefined;

  if (Node.isFunctionDeclaration(declaration)) {
    const params = declaration.getParameters();
    if (params.length > 0) {
      propsParam = params[0];
    }
  } else if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    if (initializer) {
      if (
        Node.isArrowFunction(initializer) ||
        Node.isFunctionExpression(initializer)
      ) {
        const params = initializer.getParameters();
        if (params.length > 0) {
          propsParam = params[0];
        }
      } else if (Node.isCallExpression(initializer)) {
        // React.forwardRef, React.memo などのラッパー関数の場合
        const args = initializer.getArguments();
        for (const arg of args) {
          if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
            const params = arg.getParameters();
            if (params.length > 0) {
              propsParam = params[0];
              break;
            }
          }
        }
      }
    }
  }

  if (!propsParam) {
    return [];
  }

  // パラメータの型情報を取得
  const propsType = propsParam.getType();
  return extractPropsFromType(propsType);
}

/**
 * 型からprops定義を抽出する
 *
 * Mapを使用する理由:
 * - 交差型（A & B）の場合、同じprop名が複数の型に存在する可能性がある
 * - 最初に見つかった定義を優先し、重複を排除するためにMapを使用
 * - 抽出後にindexを付与してDefinition配列として返す
 */
function extractPropsFromType(type: Type): Definition[] {
  const propsMap = new Map<string, Omit<Definition, "index">>();

  collectPropsFromType(type, propsMap);

  return Array.from(propsMap.values()).map((prop, index) => ({
    ...prop,
    index,
  }));
}

/**
 * 型からpropsを収集する（交差型の場合は再帰的に処理）
 */
function collectPropsFromType(
  type: Type,
  propsMap: Map<string, Omit<Definition, "index">>,
): void {
  if (type.isIntersection()) {
    for (const intersectionType of type.getIntersectionTypes()) {
      collectPropsFromType(intersectionType, propsMap);
    }
    return;
  }

  const properties = type.getProperties();
  for (const prop of properties) {
    const propName = prop.getName();
    const declarations = prop.getDeclarations();

    let isOptional = false;
    for (const declaration of declarations) {
      if (
        Node.isPropertySignature(declaration) &&
        declaration.hasQuestionToken()
      ) {
        isOptional = true;
        break;
      }
    }

    // 同じ名前のpropが既に存在する場合は上書きしない（最初に見つかった定義を優先）
    if (!propsMap.has(propName)) {
      propsMap.set(propName, {
        name: propName,
        required: !isOptional,
      });
    }
  }
}
