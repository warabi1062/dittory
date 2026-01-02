import fs from "node:fs";
import path from "node:path";

export type AnalyzeMode = "all" | "components" | "functions";
export type OutputMode = "simple" | "verbose";

export interface CliOptions {
  targetDir: string;
  minUsages: number;
  target: AnalyzeMode;
  output: OutputMode;
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

const VALID_OUTPUTS: readonly OutputMode[] = ["simple", "verbose"];

/** 不明なオプションの検出に使用 */
const VALID_OPTIONS: readonly string[] = [
  "--min",
  "--target",
  "--output",
  "--help",
];

/**
 * CLIオプションをパースする
 *
 * @throws {CliValidationError} オプションが無効な場合
 */
export function parseCliOptions(args: string[]): CliOptions {
  let targetDir = path.join(process.cwd(), "src");
  let minUsages = 2;
  let target: AnalyzeMode = "all";
  let output: OutputMode = "simple";
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
          `Invalid value for --min: "${valueStr}" (must be a number)`,
        );
      }
      if (value < 1) {
        throw new CliValidationError(`--min must be at least 1: ${value}`);
      }

      minUsages = value;
    } else if (arg.startsWith("--target=")) {
      const value = arg.slice(9);

      if (!VALID_TARGETS.includes(value as AnalyzeMode)) {
        throw new CliValidationError(
          `Invalid value for --target: "${value}" (valid values: ${VALID_TARGETS.join(", ")})`,
        );
      }

      target = value as AnalyzeMode;
    } else if (arg.startsWith("--output=")) {
      const value = arg.slice(9);

      if (!VALID_OUTPUTS.includes(value as OutputMode)) {
        throw new CliValidationError(
          `Invalid value for --output: "${value}" (valid values: ${VALID_OUTPUTS.join(", ")})`,
        );
      }

      output = value as OutputMode;
    } else if (arg.startsWith("--")) {
      const optionName = arg.split("=")[0];

      if (!VALID_OPTIONS.includes(optionName)) {
        throw new CliValidationError(`Unknown option: ${optionName}`);
      }
    } else {
      targetDir = arg;
    }
  }

  return { targetDir, minUsages, target, output, showHelp };
}

/**
 * 対象ディレクトリの存在を検証する
 *
 * @throws {CliValidationError} ディレクトリが存在しない、またはディレクトリでない場合
 */
export function validateTargetDir(targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    throw new CliValidationError(`Directory does not exist: ${targetDir}`);
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    throw new CliValidationError(`Path is not a directory: ${targetDir}`);
  }
}

/**
 * ヘルプメッセージを取得する
 */
export function getHelpMessage(): string {
  return `
Usage: dittory [options] [directory]

Options:
  --min=<number>    Minimum usage count (default: 2)
  --target=<mode>   Analysis target: all, components, functions (default: all)
  --output=<mode>   Output mode: simple, verbose (default: simple)
  --help            Show this help message

Arguments:
  directory         Target directory to analyze (default: ./src)
`;
}
