import fs from "node:fs";
import path from "node:path";

export type AnalyzeMode = "all" | "components" | "functions";

export interface CliOptions {
  targetDir: string;
  minUsages: number;
  target: AnalyzeMode;
  showHelp: boolean;
}

export class CliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliValidationError";
  }
}

const VALID_TARGETS: readonly AnalyzeMode[] = [
  "all",
  "components",
  "functions",
];

/** 不明なオプションの検出に使用 */
const VALID_OPTIONS: readonly string[] = ["--min", "--target", "--help"];

/**
 * CLIオプションをパースする
 *
 * @throws {CliValidationError} オプションが無効な場合
 */
export function parseCliOptions(args: string[]): CliOptions {
  let targetDir = path.join(process.cwd(), "src");
  let minUsages = 2;
  let target: AnalyzeMode = "all";
  let showHelp = false;

  for (const arg of args) {
    if (arg === "--help") {
      showHelp = true;
      continue;
    }

    if (arg.startsWith("--min=")) {
      const valueStr = arg.slice(6);
      const value = Number.parseInt(valueStr, 10);

      if (valueStr === "" || Number.isNaN(value)) {
        throw new CliValidationError(
          `--min の値が無効です: "${valueStr}" (数値を指定してください)`,
        );
      }
      if (value < 1) {
        throw new CliValidationError(
          `--min の値は1以上である必要があります: ${value}`,
        );
      }

      minUsages = value;
    } else if (arg.startsWith("--target=")) {
      const value = arg.slice(9);

      if (!VALID_TARGETS.includes(value as AnalyzeMode)) {
        throw new CliValidationError(
          `--target の値が無効です: "${value}" (有効な値: ${VALID_TARGETS.join(", ")})`,
        );
      }

      target = value as AnalyzeMode;
    } else if (arg.startsWith("--")) {
      const optionName = arg.split("=")[0];

      if (!VALID_OPTIONS.includes(optionName)) {
        throw new CliValidationError(`不明なオプション: ${optionName}`);
      }
    } else {
      targetDir = arg;
    }
  }

  return { targetDir, minUsages, target, showHelp };
}

/**
 * 対象ディレクトリの存在を検証する
 *
 * @throws {CliValidationError} ディレクトリが存在しない、またはディレクトリでない場合
 */
export function validateTargetDir(targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    throw new CliValidationError(`ディレクトリが存在しません: ${targetDir}`);
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    throw new CliValidationError(
      `指定されたパスはディレクトリではありません: ${targetDir}`,
    );
  }
}

/**
 * ヘルプメッセージを取得する
 */
export function getHelpMessage(): string {
  return `
Usage: dittory [options] [directory]

Options:
  --min=<number>    最小使用箇所数 (デフォルト: 2)
  --target=<mode>   解析対象: all, components, functions (デフォルト: all)
  --help            このヘルプを表示

Arguments:
  directory         解析対象ディレクトリ (デフォルト: ./src)
`;
}
