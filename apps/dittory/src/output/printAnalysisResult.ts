import path from "node:path";
import type { OutputMode } from "@/cli/parseCliOptions";
import type { AnalysisResult, Constant, Exported } from "@/types";

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

/**
 * 値を表示用にフォーマットする
 *
 * 内部的にはenum区別のためにファイルパスを含むが、表示時は不要なので除去する
 * 例: "/path/to/file.ts:ButtonVariant.Primary=\"primary\"" → "ButtonVariant.Primary"
 */
function formatValueForDisplay(value: string): string {
  // enum形式: "ファイルパス:EnumName.MemberName=値" のパターンをチェック
  const enumMatch = value.match(/^.+:(\w+\.\w+)=.+$/);
  if (enumMatch) {
    return enumMatch[1];
  }
  return value;
}

/**
 * グループ化された定数情報
 */
interface GroupedConstant {
  targetName: string;
  targetSourceFile: string;
  targetLine: number;
  params: Array<{
    paramName: string;
    value: string;
    usageCount: number;
    usages: Constant["usages"];
  }>;
}

/**
 * Constant[]を関数/コンポーネント単位でグループ化する
 */
function groupConstantsByTarget(constants: Constant[]): GroupedConstant[] {
  const groupMap = new Map<string, GroupedConstant>();

  for (const constant of constants) {
    const key = `${constant.targetSourceFile}:${constant.targetName}`;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        targetName: constant.targetName,
        targetSourceFile: constant.targetSourceFile,
        targetLine: constant.targetLine,
        params: [],
      };
      groupMap.set(key, group);
    }

    group.params.push({
      paramName: constant.paramName,
      value: constant.value,
      usageCount: constant.usages.length,
      usages: constant.usages,
    });
  }

  return Array.from(groupMap.values());
}

/**
 * exportされた関数の一覧を出力
 */
function printExportedFunctions(exported: Exported[]): void {
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
function printConstantArguments(constants: Constant[]): void {
  if (constants.length === 0) {
    return;
  }

  const grouped = groupConstantsByTarget(constants);

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
      console.log(
        `  - ${param.paramName} = ${formatValueForDisplay(param.value)}`,
      );
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
  const functionsWithConstants = groupConstantsByTarget(
    result.constants,
  ).length;

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

  if (result.constants.length === 0) {
    console.log("No arguments with constant values were found.");
  } else {
    printConstantArguments(result.constants);
  }

  printStatistics(result);
}
