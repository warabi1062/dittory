#!/usr/bin/env node
import { analyzeFunctionsCore } from "@/analyzeFunctions";
import { analyzePropsCore } from "@/analyzeProps";
import {
  type CliOptions,
  CliValidationError,
  getHelpMessage,
  parseCliOptions,
  validateTargetDir,
} from "@/cli/parseCliOptions";
import { printAnalysisResult } from "@/output/printAnalysisResult";
import { createFilteredSourceFiles } from "@/source/createFilteredSourceFiles";
import type { AnalysisResult } from "@/types";

/**
 * エラーメッセージを表示してプロセスを終了する
 */
function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function main(): void {
  let options: CliOptions;

  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliValidationError) {
      exitWithError(error.message);
    }
    throw error;
  }

  const { targetDir, minUsages, target, output, showHelp } = options;

  if (showHelp) {
    console.log(getHelpMessage());
    process.exit(0);
  }

  // 対象ディレクトリの存在を検証
  try {
    validateTargetDir(targetDir);
  } catch (error) {
    if (error instanceof CliValidationError) {
      exitWithError(error.message);
    }
    throw error;
  }

  if (output === "verbose") {
    console.log(`Target directory: ${targetDir}`);
    console.log(`Minimum usage count: ${minUsages}`);
    console.log(`Analysis target: ${target}\n`);
  }

  const sourceFilesToAnalyze = createFilteredSourceFiles(targetDir);

  // 各解析結果を収集
  const allExported: AnalysisResult["exported"] = [];
  const allConstants: AnalysisResult["constants"] = [];

  if (target === "all" || target === "components") {
    const propsResult = analyzePropsCore(sourceFilesToAnalyze, { minUsages });
    allExported.push(...propsResult.exported);
    allConstants.push(...propsResult.constants);
  }

  if (target === "all" || target === "functions") {
    const functionsResult = analyzeFunctionsCore(sourceFilesToAnalyze, {
      minUsages,
    });
    allExported.push(...functionsResult.exported);
    allConstants.push(...functionsResult.constants);
  }

  const result: AnalysisResult = {
    exported: allExported,
    constants: allConstants,
  };

  printAnalysisResult(result, output);
}

main();
