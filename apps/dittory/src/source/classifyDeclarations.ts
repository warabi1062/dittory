import { Node, type SourceFile } from "ts-morph";
import { isReactComponent } from "@/components/isReactComponent";
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
  const results: ClassifiedDeclaration[] = [];

  for (const sourceFile of sourceFiles) {
    const exportedDecls = sourceFile.getExportedDeclarations();

    for (const [exportName, declarations] of exportedDecls) {
      // 関数宣言または変数宣言（アロー関数/関数式）を見つける
      const funcDecl = declarations.find((decl) => isFunctionLike(decl));

      if (funcDecl) {
        if (
          Node.isFunctionDeclaration(funcDecl) ||
          Node.isVariableDeclaration(funcDecl)
        ) {
          const type: DeclarationType = isReactComponent(funcDecl)
            ? "react"
            : "function";
          results.push({
            exportName,
            sourceFile,
            declaration: funcDecl,
            type,
          });
        }
        continue;
      }

      // クラス宣言を見つける
      const classDecl = declarations.find((decl) =>
        Node.isClassDeclaration(decl),
      );

      if (classDecl && Node.isClassDeclaration(classDecl)) {
        results.push({
          exportName,
          sourceFile,
          declaration: classDecl,
          type: "class",
        });
      }
    }
  }

  return results;
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
