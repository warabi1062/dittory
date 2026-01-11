import path from "node:path";
import type { OutputMode } from "@/cli/parseCliOptions";
import type { Constants } from "@/constants";
import type { Exporteds } from "@/exporteds";
import type { AnalysisResult } from "@/types";

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

/**
 * exportされた関数の一覧を出力
 */
function printExportedFunctions(exported: Exporteds): void {
  const lines = [
    "Collecting exported functions...",
    `   → Found ${exported.length} function(s)`,
    ...exported.map(
      (fn) =>
        `      - ${bold(green(fn.name))} (${path.relative(
          process.cwd(),
          fn.sourceFilePath,
        )})`,
    ),
    "",
  ];
  console.log(lines.join("\n"));
}

/**
 * 常に同じ値が渡されている引数を出力
 */
function printConstantArguments(constants: Constants): void {
  if (constants.isEmpty()) {
    return;
  }

  const grouped = constants.groupByTarget();

  for (const group of grouped) {
    const relativePath = path.relative(process.cwd(), group.targetSourceFile);
    const usageCount = group.params[0]?.usageCount ?? 0;
    // 使用箇所は全パラメータで同じなので、最初のパラメータから取得
    const usages = group.params[0]?.usages ?? [];

    console.log(
      `${bold(green(group.targetName))} ${relativePath}:${group.targetLine}`,
    );
    console.log("Constant Arguments:");

    for (const param of group.params) {
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
  const totalFunctions = result.exported.length;
  const functionsWithConstants = result.constants.groupByTarget().length;

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
    printExportedFunctions(result.exported);
  }

  if (result.constants.isEmpty()) {
    console.log("No arguments with constant values were found.");
  } else {
    printConstantArguments(result.constants);
  }

  printStatistics(result);
}
