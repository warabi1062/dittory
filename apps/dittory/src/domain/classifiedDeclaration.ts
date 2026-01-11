import type {
  ClassDeclaration,
  FunctionDeclaration,
  SourceFile,
  VariableDeclaration,
} from "ts-morph";

/**
 * 宣言の種別
 */
export type DeclarationType = "react" | "function" | "class";

/**
 * 事前分類済みの宣言
 */
export interface ClassifiedDeclaration {
  exportName: string;
  sourceFile: SourceFile;
  declaration: FunctionDeclaration | VariableDeclaration | ClassDeclaration;
  type: DeclarationType;
}
