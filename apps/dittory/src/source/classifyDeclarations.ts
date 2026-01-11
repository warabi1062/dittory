import { Node, type SourceFile } from "ts-morph";
import { isReactComponent } from "@/react/isReactComponent";
import type { ClassifiedDeclaration, DeclarationType } from "@/types";

/**
 * ソースファイルからexportされた関数/コンポーネント/クラス宣言を収集し、
 * 種別（react/function/class）を事前に分類する
 *
 * @param sourceFiles - 分析対象のソースファイル配列
 * @returns 分類済みの宣言配列
 */
export function classifyDeclarations(
  sourceFiles: SourceFile[],
): ClassifiedDeclaration[] {
  const classifiedDeclarations: ClassifiedDeclaration[] = [];

  for (const sourceFile of sourceFiles) {
    const exportedDecls = sourceFile.getExportedDeclarations();

    for (const [exportName, declarations] of exportedDecls) {
      // 関数宣言または変数宣言（アロー関数/関数式）を見つける
      const functionLikeDeclaration = declarations.find((declaration) =>
        isFunctionLike(declaration),
      );

      if (functionLikeDeclaration) {
        if (
          Node.isFunctionDeclaration(functionLikeDeclaration) ||
          Node.isVariableDeclaration(functionLikeDeclaration)
        ) {
          const type: DeclarationType = isReactComponent(
            functionLikeDeclaration,
          )
            ? "react"
            : "function";
          classifiedDeclarations.push({
            exportName,
            sourceFile,
            declaration: functionLikeDeclaration,
            type,
          });
        }
        continue;
      }

      // クラス宣言を見つける
      const classDeclaration = declarations.find((declaration) =>
        Node.isClassDeclaration(declaration),
      );

      if (classDeclaration && Node.isClassDeclaration(classDeclaration)) {
        classifiedDeclarations.push({
          exportName,
          sourceFile,
          declaration: classDeclaration,
          type: "class",
        });
      }
    }
  }

  return classifiedDeclarations;
}

/**
 * 宣言が関数的なもの（関数宣言、アロー関数、関数式）かどうかを判定
 */
function isFunctionLike(declaration: Node): boolean {
  if (Node.isFunctionDeclaration(declaration)) {
    return true;
  }

  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer) {
      return false;
    }

    return (
      Node.isArrowFunction(initializer) ||
      Node.isFunctionExpression(initializer) ||
      Node.isCallExpression(initializer) // React.forwardRef, React.memo など
    );
  }

  return false;
}
