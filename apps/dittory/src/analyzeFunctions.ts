import type { SourceFile } from "ts-morph";
import { AnalyzedDeclarations } from "@/analyzedDeclarations";
import { ClassMethodAnalyzer } from "@/analyzer/classMethodAnalyzer";
import { FunctionAnalyzer } from "@/analyzer/functionAnalyzer";
import { ConstantParams } from "@/constantParams";
import type { CallSiteMap } from "@/extraction/callSiteMap";
import type { ValueType } from "@/extraction/valueTypeDetector";
import { classifyDeclarations } from "@/source/classifyDeclarations";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type { AnalysisResult, FileFilter } from "@/types";

interface AnalyzeFunctionsOptions {
  shouldExcludeFile?: FileFilter;
  minUsages?: number;
  /** 検出対象の値種別。デフォルト: "all" */
  allowedValueTypes?: ValueType[] | "all";
  /** 呼び出し情報（パラメータ経由で渡された値を解決するために使用） */
  callSiteMap: CallSiteMap;
}

/**
 * 関数・クラスメソッドの引数使用状況を解析し、常に同じ値が渡されている引数を検出する
 *
 * @param sourceFiles - 解析対象のソースファイル配列
 * @param options - オプション設定
 * @returns 解析結果（定数引数、統計情報、exportされた関数・メソッド）
 *
 * @example
 * const project = new Project();
 * project.addSourceFilesAtPaths("src/**\/*.ts");
 * const result = analyzeFunctionsCore(project.getSourceFiles());
 */
export function analyzeFunctionsCore(
  sourceFiles: SourceFile[],
  options: AnalyzeFunctionsOptions,
): AnalysisResult {
  const {
    shouldExcludeFile = isTestOrStorybookFile,
    minUsages = 2,
    allowedValueTypes = "all",
    callSiteMap,
  } = options;

  // 宣言を事前分類
  const declarations = classifyDeclarations(sourceFiles);
  const functions = declarations.filter((decl) => decl.type === "function");
  const classes = declarations.filter((decl) => decl.type === "class");

  const analyzerOptions = { shouldExcludeFile, minUsages, allowedValueTypes };

  // 関数を分析
  const functionAnalyzer = new FunctionAnalyzer(analyzerOptions);
  functionAnalyzer.setCallSiteMap(callSiteMap);
  const functionResult = functionAnalyzer.analyze(functions);

  // クラスメソッドを分析
  const classMethodAnalyzer = new ClassMethodAnalyzer(analyzerOptions);
  classMethodAnalyzer.setCallSiteMap(callSiteMap);
  const classMethodResult = classMethodAnalyzer.analyze(classes);

  // 結果をマージ
  return {
    constantParams: ConstantParams.merge(
      functionResult.constantParams,
      classMethodResult.constantParams,
    ),
    declarations: AnalyzedDeclarations.merge(
      functionResult.declarations,
      classMethodResult.declarations,
    ),
  };
}
