#!/usr/bin/env node
import path from "node:path";
import { analyzeFunctionsCore } from "@/analyzeFunctions";
import { analyzePropsCore } from "@/analyzeProps";
import { loadConfig } from "@/cli/loadConfig";
import {
  CliValidationError,
  DEFAULT_OPTIONS,
  getHelpMessage,
  parseCliOptions,
  type ResolvedOptions,
  validateTargetDir,
  validateTsConfig,
} from "@/cli/parseCliOptions";
import { CallSiteCollector } from "@/extraction/callSiteCollector";
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

async function main(): Promise<void> {
  // CLI オプションをパース
  let cliOptions: ReturnType<typeof parseCliOptions>;
  try {
    cliOptions = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliValidationError) {
      exitWithError(error.message);
    }
    throw error;
  }

  if (cliOptions.showHelp) {
    console.log(getHelpMessage());
    process.exit(0);
  }

  // コンフィグファイルを読み込む
  let fileConfig: Awaited<ReturnType<typeof loadConfig>>;
  try {
    fileConfig = await loadConfig();
  } catch (error) {
    if (error instanceof Error) {
      exitWithError(error.message);
    }
    throw error;
  }

  // オプションをマージ: CLI > コンフィグ > デフォルト
  const options: ResolvedOptions = {
    targetDir: path.resolve(
      cliOptions.targetDir ?? fileConfig.targetDir ?? DEFAULT_OPTIONS.targetDir,
    ),
    minUsages:
      cliOptions.minUsages ?? fileConfig.minUsages ?? DEFAULT_OPTIONS.minUsages,
    target: cliOptions.target ?? fileConfig.target ?? DEFAULT_OPTIONS.target,
    output: cliOptions.output ?? fileConfig.output ?? DEFAULT_OPTIONS.output,
    tsconfig:
      cliOptions.tsconfig ?? fileConfig.tsconfig ?? DEFAULT_OPTIONS.tsconfig,
    valueTypes:
      cliOptions.valueTypes ??
      fileConfig.valueTypes ??
      DEFAULT_OPTIONS.valueTypes,
  };

  const { targetDir, minUsages, target, output, tsconfig, valueTypes } =
    options;

  // 対象ディレクトリの存在を検証
  try {
    validateTargetDir(targetDir);
  } catch (error) {
    if (error instanceof CliValidationError) {
      exitWithError(error.message);
    }
    throw error;
  }

  // tsconfig.json の存在を検証
  try {
    validateTsConfig(tsconfig);
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

  const sourceFilesToAnalyze = createFilteredSourceFiles(targetDir, {
    tsConfigFilePath: tsconfig,
  });

  // 呼び出し情報を事前収集（パラメータ経由で渡された値を解決するために使用）
  const callSiteMap = new CallSiteCollector().collect(sourceFilesToAnalyze);

  // 各解析結果を収集
  const allExported: AnalysisResult["exported"] = [];
  const allConstants: AnalysisResult["constants"] = [];

  if (target === "all" || target === "components") {
    const propsResult = analyzePropsCore(sourceFilesToAnalyze, {
      minUsages,
      valueTypes,
      callSiteMap,
    });
    allExported.push(...propsResult.exported);
    allConstants.push(...propsResult.constants);
  }

  if (target === "all" || target === "functions") {
    const functionsResult = analyzeFunctionsCore(sourceFilesToAnalyze, {
      minUsages,
      valueTypes,
      callSiteMap,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
