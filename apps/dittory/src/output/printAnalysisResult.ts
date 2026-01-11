import path from "node:path";
import type { OutputMode } from "@/cli/parseCliOptions";
import type { AnalysisResult } from "@/domain/analysisResult";
import type { AnalyzedDeclarations } from "@/domain/analyzedDeclarations";
import type { ConstantParams } from "@/domain/constantParams";

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

/**
 * 分析対象の一覧を出力
 */
function printDeclarations(declarations: AnalyzedDeclarations): void {
  const lines = [
    "Collecting exported functions...",
    `   → Found ${declarations.length} function(s)`,
    ...declarations.map(
      (decl) =>
        `      - ${bold(green(decl.name))} (${path.relative(
          process.cwd(),
          decl.sourceFilePath,
        )})`,
    ),
    "",
  ];
  console.log(lines.join("\n"));
}

/**
 * 常に同じ値が渡されている引数を出力
 */
function printConstantParams(constantParams: ConstantParams): void {
  if (constantParams.isEmpty()) {
    return;
  }

  const grouped = constantParams.groupByDeclaration();

  for (const constantParamGroup of grouped) {
    const relativePath = path.relative(
      process.cwd(),
      constantParamGroup.declarationSourceFile,
    );
    const usageCount = constantParamGroup.params[0]?.usageCount ?? 0;
    // 使用箇所は全パラメータで同じなので、最初のパラメータから取得
    const usages = constantParamGroup.params[0]?.usages ?? [];

    console.log(
      `${bold(green(constantParamGroup.declarationName))} ${relativePath}:${constantParamGroup.declarationLine}`,
    );
    console.log("Constant Arguments:");

    for (const param of constantParamGroup.params) {
      console.log(`  - ${param.paramName} = ${param.value.outputString()}`);
    }

    console.log(`Usages (${usageCount}):`);
    for (const usage of usages) {
      const usagePath = path.relative(process.cwd(), usage.usageFilePath);
      console.log(`  - ${usagePath}:${usage.usageLine}`);
    }

    console.log("\n");
  }
}

/**
 * 統計情報を出力
 */
function printStatistics(result: AnalysisResult): void {
  const totalFunctions = result.declarations.length;
  const functionsWithConstants =
    result.constantParams.groupByDeclaration().length;

  console.log("---");
  console.log(
    `Found ${functionsWithConstants} function(s) with constant arguments out of ${totalFunctions} function(s).`,
  );
}

/**
 * 解析結果を出力
 */
export function printAnalysisResult(
  result: AnalysisResult,
  mode: OutputMode,
): void {
  if (mode === "verbose") {
    printDeclarations(result.declarations);
  }

  if (result.constantParams.isEmpty()) {
    console.log("No arguments with constant values were found.");
  } else {
    printConstantParams(result.constantParams);
  }

  printStatistics(result);
}
