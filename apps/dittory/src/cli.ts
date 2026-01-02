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
import {
  printAnalysisResult,
  printFunctionAnalysisResult,
} from "@/output/printAnalysisResult";
import { createFilteredSourceFiles } from "@/source/createFilteredSourceFiles";

/**
 * エラーメッセージを表示してプロセスを終了する
 */
function exitWithError(message: string): never {
  console.error(`エラー: ${message}`);
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

  const { targetDir, minUsages, target, showHelp } = options;

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

  console.log(`解析対象ディレクトリ: ${targetDir}`);
  console.log(`最小使用箇所数: ${minUsages}`);
  console.log(`解析対象: ${target}\n`);

  const sourceFilesToAnalyze = createFilteredSourceFiles(targetDir);

  if (target === "all" || target === "components") {
    const propsResult = analyzePropsCore(sourceFilesToAnalyze, { minUsages });
    printAnalysisResult(propsResult);
  }

  if (target === "all" || target === "functions") {
    const functionsResult = analyzeFunctionsCore(sourceFilesToAnalyze, {
      minUsages,
    });
    printFunctionAnalysisResult(functionsResult);
  }
}

main();
