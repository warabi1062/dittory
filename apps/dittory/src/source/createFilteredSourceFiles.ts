import path from "node:path";
import { Project, type SourceFile } from "ts-morph";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type { FileFilter } from "@/types";

export interface CreateFilteredSourceFilesOptions {
  shouldExcludeFile?: FileFilter;
  tsConfigFilePath?: string;
}

/**
 * プロジェクトを初期化し、フィルタリングされたソースファイルを取得する
 */
export function createFilteredSourceFiles(
  targetDir: string,
  options: CreateFilteredSourceFilesOptions = {},
): SourceFile[] {
  const {
    shouldExcludeFile = isTestOrStorybookFile,
    tsConfigFilePath = path.join(process.cwd(), "tsconfig.json"),
  } = options;

  // プロジェクトを初期化
  const project = new Project({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  });

  // 対象ディレクトリのファイルを追加
  project.addSourceFilesAtPaths(`${targetDir}/**/*.{ts,tsx,js,jsx}`);

  // ファイルをフィルタリング
  const allSourceFiles = project.getSourceFiles();
  const sourceFilesToAnalyze = allSourceFiles.filter(
    (sourceFile) => !shouldExcludeFile(sourceFile.getFilePath()),
  );

  return sourceFilesToAnalyze;
}
