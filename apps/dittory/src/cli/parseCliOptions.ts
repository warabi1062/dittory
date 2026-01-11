import fs from "node:fs";
import {
  VALID_VALUE_TYPES,
  type ValueType,
} from "@/extraction/valueTypeDetector";

export type AnalyzeMode = "all" | "components" | "functions";
export type OutputMode = "simple" | "verbose";

/**
 * CLI で明示的に指定されたオプション（デフォルト値なし）
 */
export interface RawCliOptions {
  targetDir?: string;
  minUsages?: number;
  target?: AnalyzeMode;
  output?: OutputMode;
  tsconfig?: string;
  valueTypes?: ValueType[];
  showHelp: boolean;
}

/**
 * 解決済みのオプション（デフォルト値適用後）
 */
export interface ResolvedOptions {
  targetDir: string;
  minUsages: number;
  target: AnalyzeMode;
  output: OutputMode;
  tsconfig: string;
  valueTypes: ValueType[] | "all";
}

/** デフォルトのオプション値 */
export const DEFAULT_OPTIONS: ResolvedOptions = {
  targetDir: "./src",
  minUsages: 2,
  target: "all",
  output: "simple",
  tsconfig: "./tsconfig.json",
  valueTypes: "all",
};

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
  "--tsconfig",
  "--value-types",
  "--help",
];

/**
 * CLIオプションをパースする
 *
 * 明示的に指定されたオプションのみを返す（デフォルト値は含まない）
 *
 * @throws {CliValidationError} オプションが無効な場合
 */
export function parseCliOptions(args: string[]): RawCliOptions {
  const result: RawCliOptions = { showHelp: false };

  for (const arg of args) {
    if (arg === "--help") {
      result.showHelp = true;
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

      result.minUsages = value;
    } else if (arg.startsWith("--target=")) {
      const value = arg.slice(9);

      if (!VALID_TARGETS.includes(value as AnalyzeMode)) {
        throw new CliValidationError(
          `Invalid value for --target: "${value}" (valid values: ${VALID_TARGETS.join(
            ", ",
          )})`,
        );
      }

      result.target = value as AnalyzeMode;
    } else if (arg.startsWith("--output=")) {
      const value = arg.slice(9);

      if (!VALID_OUTPUTS.includes(value as OutputMode)) {
        throw new CliValidationError(
          `Invalid value for --output: "${value}" (valid values: ${VALID_OUTPUTS.join(
            ", ",
          )})`,
        );
      }

      result.output = value as OutputMode;
    } else if (arg.startsWith("--tsconfig=")) {
      const value = arg.slice(11);

      if (value === "") {
        throw new CliValidationError(
          "Invalid value for --tsconfig: path cannot be empty",
        );
      }

      result.tsconfig = value;
    } else if (arg.startsWith("--value-types=")) {
      const value = arg.slice(14);

      if (value === "") {
        throw new CliValidationError(
          "Invalid value for --value-types: value cannot be empty",
        );
      }

      // "all" の場合はデフォルト扱い（RawCliOptionsには含めない）
      if (value === "all") {
        continue;
      }

      const types = value.split(",").map((t) => t.trim());
      for (const type of types) {
        if (!VALID_VALUE_TYPES.includes(type as ValueType)) {
          throw new CliValidationError(
            `Invalid value type: "${type}" (valid values: ${VALID_VALUE_TYPES.join(", ")}, all)`,
          );
        }
      }

      result.valueTypes = types as ValueType[];
    } else if (arg.startsWith("--")) {
      const optionName = arg.split("=")[0];

      if (!VALID_OPTIONS.includes(optionName)) {
        throw new CliValidationError(`Unknown option: ${optionName}`);
      }
    } else {
      result.targetDir = arg;
    }
  }

  return result;
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
 * tsconfig.json の存在を検証する
 *
 * @throws {CliValidationError} ファイルが存在しない場合
 */
export function validateTsConfig(tsConfigPath: string): void {
  if (!fs.existsSync(tsConfigPath)) {
    throw new CliValidationError(`tsconfig not found: ${tsConfigPath}`);
  }
}

/**
 * ヘルプメッセージを取得する
 */
export function getHelpMessage(): string {
  return `
Usage: dittory [options] [directory]

Options:
  --min=<number>       Minimum usage count (default: 2)
  --target=<mode>      Analysis target: all, components, functions (default: all)
  --output=<mode>      Output mode: simple, verbose (default: simple)
  --tsconfig=<path>    Path to tsconfig.json (default: ./tsconfig.json)
  --value-types=<types> Value types to detect: boolean, number, string, enum, undefined, all (default: all)
                        Multiple types can be specified with comma: --value-types=boolean,string
  --help               Show this help message

Arguments:
  directory            Target directory to analyze (default: ./src)
`;
}
