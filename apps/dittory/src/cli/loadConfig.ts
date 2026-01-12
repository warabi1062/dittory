import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  VALID_VALUE_TYPES,
  type ValueType,
} from "@/extraction/valueTypeDetector";
import type { AnalyzeMode } from "./parseCliOptions";

/** コンフィグファイルの検索順序 */
const CONFIG_FILE_NAMES = [
  "dittory.config.js",
  "dittory.config.mjs",
  "dittory.config.json",
] as const;

/**
 * コンフィグファイルの設定項目
 */
export interface DittoryConfig {
  minUsages?: number;
  target?: AnalyzeMode;
  debug?: boolean;
  tsconfig?: string;
  targetDir?: string;
  allowedValueTypes?: ValueType[] | "all";
}

/**
 * コンフィグファイルを読み込む
 *
 * 現在の作業ディレクトリから以下の順序でコンフィグファイルを探す：
 * 1. dittory.config.js
 * 2. dittory.config.mjs
 * 3. dittory.config.json
 *
 * ファイルが存在しない場合は空のオブジェクトを返す。
 *
 * @returns コンフィグオブジェクト
 * @throws {Error} コンフィグファイルの読み込みに失敗した場合
 */
export async function loadConfig(): Promise<DittoryConfig> {
  const cwd = process.cwd();

  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.join(cwd, fileName);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    if (fileName.endsWith(".json")) {
      return loadJsonConfig(configPath);
    }
    return loadJsConfig(configPath);
  }

  return {};
}

/**
 * JSON コンフィグを読み込む
 */
function loadJsonConfig(configPath: string): DittoryConfig {
  const content = fs.readFileSync(configPath, "utf-8");

  try {
    const config: unknown = JSON.parse(content);

    if (typeof config !== "object" || config === null) {
      throw new Error(`Invalid config: expected object, got ${typeof config}`);
    }

    return validateConfig(config as Record<string, unknown>);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse ${path.basename(configPath)}: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * JS コンフィグを読み込む
 */
async function loadJsConfig(configPath: string): Promise<DittoryConfig> {
  try {
    // Windows 対応のため file:// URL に変換
    const fileUrl = pathToFileURL(configPath).href;
    const module = (await import(fileUrl)) as { default?: unknown };
    const config = module.default;

    if (typeof config !== "object" || config === null) {
      throw new Error(`Invalid config: expected object, got ${typeof config}`);
    }

    return validateConfig(config as Record<string, unknown>);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load ${path.basename(configPath)}: ${error.message}`,
      );
    }
    throw error;
  }
}

const VALID_TARGETS: readonly AnalyzeMode[] = [
  "all",
  "react-components",
  "functions",
];

/**
 * コンフィグの値を検証する
 */
function validateConfig(config: Record<string, unknown>): DittoryConfig {
  const result: DittoryConfig = {};

  if ("minUsages" in config) {
    if (typeof config.minUsages !== "number" || config.minUsages < 1) {
      throw new Error(
        `Invalid config: minUsages must be a number >= 1, got ${config.minUsages}`,
      );
    }
    result.minUsages = config.minUsages;
  }

  if ("target" in config) {
    if (!VALID_TARGETS.includes(config.target as AnalyzeMode)) {
      throw new Error(
        `Invalid config: target must be one of ${VALID_TARGETS.join(", ")}, got ${config.target}`,
      );
    }
    result.target = config.target as AnalyzeMode;
  }

  if ("debug" in config) {
    if (typeof config.debug !== "boolean") {
      throw new Error(
        `Invalid config: debug must be a boolean, got ${typeof config.debug}`,
      );
    }
    result.debug = config.debug;
  }

  if ("tsconfig" in config) {
    if (typeof config.tsconfig !== "string" || config.tsconfig === "") {
      throw new Error(
        `Invalid config: tsconfig must be a non-empty string, got ${config.tsconfig}`,
      );
    }
    result.tsconfig = config.tsconfig;
  }

  if ("targetDir" in config) {
    if (typeof config.targetDir !== "string" || config.targetDir === "") {
      throw new Error(
        `Invalid config: targetDir must be a non-empty string, got ${config.targetDir}`,
      );
    }
    result.targetDir = config.targetDir;
  }

  if ("valueTypes" in config) {
    const value = config.valueTypes;

    if (value === "all") {
      result.allowedValueTypes = "all";
    } else if (Array.isArray(value)) {
      for (const type of value) {
        if (!VALID_VALUE_TYPES.includes(type as ValueType)) {
          throw new Error(
            `Invalid config: valueTypes contains invalid type "${type}" (valid values: ${VALID_VALUE_TYPES.join(", ")}, all)`,
          );
        }
      }
      result.allowedValueTypes = value as ValueType[];
    } else {
      throw new Error(
        `Invalid config: valueTypes must be "all" or an array of value types, got ${value}`,
      );
    }
  }

  return result;
}
