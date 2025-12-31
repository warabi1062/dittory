import path from "node:path";
import type { AnalysisResult, Constant, Exported } from "@/types";

/**
 * exportされたコンポーネントの一覧を出力
 */
export function printExportedComponents(exported: Exported[]): void {
  const lines = [
    "1. exportされたコンポーネントを収集中...",
    `   → ${exported.length}個のコンポーネントを検出`,
    ...exported.map(
      (comp) =>
        `      - ${comp.name} (${path.relative(process.cwd(), comp.sourceFilePath)})`,
    ),
    "",
  ];
  console.log(lines.join("\n"));
}

/**
 * 常に同じ値が渡されているpropsを出力
 */
export function printConstantProps(constants: Constant[]): void {
  console.log("=== 常に同じ値が渡されているprops ===\n");

  if (constants.length === 0) {
    console.log("常に同じ値が渡されているpropsは見つかりませんでした。");
    return;
  }

  for (const prop of constants) {
    const relativeComponentPath = path.relative(
      process.cwd(),
      prop.targetSourceFile,
    );

    console.log(`コンポーネント: ${prop.targetName}`);
    console.log(`  定義: ${relativeComponentPath}`);
    console.log(`  prop: ${prop.paramName}`);
    console.log(`  常に渡される値: ${prop.value}`);
    console.log(`  使用箇所: ${prop.usages.length}箇所`);

    for (const usage of prop.usages) {
      const relativePath = path.relative(process.cwd(), usage.usageFilePath);
      console.log(`    - ${relativePath}:${usage.usageLine}`);
    }

    console.log("");
  }
}

/**
 * 解析結果を全て出力
 */
export function printAnalysisResult(result: AnalysisResult): void {
  printExportedComponents(result.exported);
  printConstantProps(result.constants);
}

/**
 * exportされた関数の一覧を出力
 */
export function printExportedFunctions(exported: Exported[]): void {
  const lines = [
    "2. exportされた関数を収集中...",
    `   → ${exported.length}個の関数を検出`,
    ...exported.map(
      (fn) =>
        `      - ${fn.name} (${path.relative(process.cwd(), fn.sourceFilePath)})`,
    ),
    "",
  ];
  console.log(lines.join("\n"));
}

/**
 * 常に同じ値が渡されている引数を出力
 */
export function printConstantArguments(constants: Constant[]): void {
  console.log("=== 常に同じ値が渡されている引数 ===\n");

  if (constants.length === 0) {
    console.log("常に同じ値が渡されている引数は見つかりませんでした。");
    return;
  }

  for (const arg of constants) {
    const relativeFunctionPath = path.relative(
      process.cwd(),
      arg.targetSourceFile,
    );

    console.log(`関数: ${arg.targetName}`);
    console.log(`  定義: ${relativeFunctionPath}`);
    console.log(`  引数: ${arg.paramName}`);
    console.log(`  常に渡される値: ${arg.value}`);
    console.log(`  使用箇所: ${arg.usages.length}箇所`);

    for (const usage of arg.usages) {
      const relativePath = path.relative(process.cwd(), usage.usageFilePath);
      console.log(`    - ${relativePath}:${usage.usageLine}`);
    }

    console.log("");
  }
}

/**
 * 関数解析結果を全て出力
 */
export function printFunctionAnalysisResult(result: AnalysisResult): void {
  printExportedFunctions(result.exported);
  printConstantArguments(result.constants);
}
