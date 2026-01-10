export { analyzeFunctionsCore } from "@/analyzeFunctions";
export { analyzePropsCore } from "@/analyzeProps";
export type { DittoryConfig } from "@/cli/loadConfig";
export type { AnalyzeMode, OutputMode } from "@/cli/parseCliOptions";
export type { CallSiteMap } from "@/extraction/argValue";
export { collectCallSites } from "@/extraction/callSiteCollector";
export type {
  AnalysisResult,
  Constant,
  Definition,
  Exported,
  FileFilter,
  Usage,
} from "@/types";
