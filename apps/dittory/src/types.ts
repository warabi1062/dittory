import type {
  ClassDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  SourceFile,
  VariableDeclaration,
} from "ts-morph";

/**
 * ファイルパスを受け取り、除外すべきかどうかを判定する関数の型
 */
export type FileFilter = (filePath: string) => boolean;

// ===== 共通interface =====

/**
 * 使用箇所の共通interface
 * 関数呼び出しやJSX要素で、どのパラメータにどの値が渡されたかを記録する
 */
export interface Usage {
  /** ネストしたプロパティの場合は "param.nested.key" 形式 */
  name: string;
  /** リテラル値、enum参照、変数参照などを解決した結果 */
  value: string;
  usageFilePath: string;
  usageLine: number;
}

/**
 * パラメータ/props定義の共通interface
 */
export interface Definition {
  name: string;
  /** 引数リストにおける位置（0始まり） */
  index: number;
  /** ?がなく、デフォルト値もない場合はtrue */
  required: boolean;
}

/**
 * エクスポートされた対象の共通interface
 */
export interface Exported {
  /** クラスメソッドの場合は "ClassName.methodName" 形式 */
  name: string;
  sourceFilePath: string;
  sourceLine: number;
  definitions: Definition[];
  declaration: FunctionDeclaration | VariableDeclaration | MethodDeclaration;
  usages: Record<string, Usage[]>;
}

/**
 * 常に同じ値が渡されているパラメータ（デフォルト値化の候補）
 */
export interface Constant {
  targetName: string;
  targetSourceFile: string;
  targetLine: number;
  paramName: string;
  value: string;
  usages: Usage[];
}

/**
 * 分析結果
 */
export interface AnalysisResult {
  constants: Constant[];
  exported: Exported[];
}

/**
 * Analyzerの共通オプション
 */
export interface AnalyzerOptions {
  shouldExcludeFile?: FileFilter;
  /** デフォルト: 2 */
  minUsages?: number;
}

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
