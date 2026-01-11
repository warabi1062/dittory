import type { AnalyzedDeclarations } from "@/domain/analyzedDeclarations";
import type { ConstantParams } from "@/domain/constantParams";

/**
 * 分析結果
 */
export interface AnalysisResult {
  constantParams: ConstantParams;
  declarations: AnalyzedDeclarations;
}
