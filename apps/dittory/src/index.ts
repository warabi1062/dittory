export { analyzeFunctionsCore } from "@/analyzeFunctions";
export { analyzePropsCore } from "@/analyzeProps";
export type { DittoryConfig } from "@/cli/loadConfig";
export type { AnalyzeMode, OutputMode } from "@/cli/parseCliOptions";
export { CallSiteCollector } from "@/extraction/callSiteCollector";
export { CallSiteMap } from "@/extraction/callSiteMap";
export type {
  AnalysisResult,
  AnalyzedDeclaration,
  ConstantParam,
  Definition,
  FileFilter,
  Usage,
} from "@/types";
