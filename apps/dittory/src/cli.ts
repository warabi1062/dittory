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
import type { AnalysisResult } from "@/domain/analysisResult";
import { AnalyzedDeclarations } from "@/domain/analyzedDeclarations";
import { ConstantParams } from "@/domain/constantParams";
import { CallSiteCollector } from "@/extraction/callSiteCollector";
import { printAnalysisResult } from "@/output/printAnalysisResult";
import { createFilteredSourceFiles } from "@/source/createFilteredSourceFiles";

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
    debug: cliOptions.debug ?? fileConfig.debug ?? DEFAULT_OPTIONS.debug,
    tsconfig:
      cliOptions.tsconfig ?? fileConfig.tsconfig ?? DEFAULT_OPTIONS.tsconfig,
    allowedValueTypes:
      cliOptions.allowedValueTypes ??
      fileConfig.allowedValueTypes ??
      DEFAULT_OPTIONS.allowedValueTypes,
  };

  const { targetDir, minUsages, target, debug, tsconfig, allowedValueTypes } =
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

  if (debug) {
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
  const declarationsToMerge: AnalyzedDeclarations[] = [];
  const constantParamsToMerge: ConstantParams[] = [];

  if (target === "all" || target === "components") {
    const propsResult = analyzePropsCore(sourceFilesToAnalyze, {
      minUsages,
      allowedValueTypes,
      callSiteMap,
    });
    declarationsToMerge.push(propsResult.declarations);
    constantParamsToMerge.push(propsResult.constantParams);
  }

  if (target === "all" || target === "functions") {
    const functionsResult = analyzeFunctionsCore(sourceFilesToAnalyze, {
      minUsages,
      allowedValueTypes,
      callSiteMap,
    });
    declarationsToMerge.push(functionsResult.declarations);
    constantParamsToMerge.push(functionsResult.constantParams);
  }

  const result: AnalysisResult = {
    declarations: AnalyzedDeclarations.merge(...declarationsToMerge),
    constantParams: ConstantParams.merge(...constantParamsToMerge),
  };

  printAnalysisResult(result, debug);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
