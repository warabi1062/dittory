import type { ValueType } from "@/extraction/valueTypeDetector";

/**
 * ファイルパスを受け取り、除外すべきかどうかを判定する関数の型
 */
export type FileFilter = (filePath: string) => boolean;

/**
 * Analyzerの共通オプション
 */
export interface AnalyzerOptions {
  shouldExcludeFile?: FileFilter;
  /** デフォルト: 2 */
  minUsages?: number;
  /** 検出対象の値種別。デフォルト: "all" */
  allowedValueTypes?: ValueType[] | "all";
}
