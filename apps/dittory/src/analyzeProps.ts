import type { SourceFile } from "ts-morph";
import { ComponentAnalyzer } from "@/analyzer/componentAnalyzer";
import type { AnalysisResult } from "@/domain/analysisResult";
import type { FileFilter } from "@/domain/analyzerOptions";
import type { CallSiteMap } from "@/domain/callSiteMap";
import type { ValueType } from "@/extraction/valueTypeDetector";
import { classifyDeclarations } from "@/source/classifyDeclarations";
import { isTestOrStorybookFile } from "@/source/fileFilters";

interface AnalyzePropsOptions {
  shouldExcludeFile?: FileFilter;
  minUsages?: number;
  /** 検出対象の値種別。デフォルト: "all" */
  allowedValueTypes?: ValueType[] | "all";
  /** 呼び出し情報（パラメータ経由で渡された値を解決するために使用） */
  callSiteMap: CallSiteMap;
}

/**
 * コンポーネントのprops使用状況を解析し、常に同じ値が渡されているpropsを検出する
 *
 * @param sourceFiles - 解析対象のソースファイル配列
 * @param options - オプション設定
 * @returns 解析結果（定数props、統計情報、exportされたコンポーネント）
 *
 * @example
 * const project = new Project();
 * project.addSourceFilesAtPaths("src/**\/*.tsx");
 * const result = analyzePropsCore(project.getSourceFiles());
 */
export function analyzePropsCore(
  sourceFiles: SourceFile[],
  options: AnalyzePropsOptions,
): AnalysisResult {
  const {
    shouldExcludeFile = isTestOrStorybookFile,
    minUsages = 2,
    allowedValueTypes = "all",
    callSiteMap,
  } = options;

  // 宣言を事前分類し、Reactコンポーネントのみ抽出
  const declarations = classifyDeclarations(sourceFiles);
  const components = declarations.filter((decl) => decl.type === "react");

  const analyzer = new ComponentAnalyzer({
    shouldExcludeFile,
    minUsages,
    allowedValueTypes,
  });
  analyzer.setCallSiteMap(callSiteMap);

  return analyzer.analyze(components);
}
