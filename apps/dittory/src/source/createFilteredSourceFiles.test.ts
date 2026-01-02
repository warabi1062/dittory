import path from "node:path";
import { Project } from "ts-morph";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilteredSourceFiles } from "@/source/createFilteredSourceFiles";

/**
 * テスト用フィルター：拡張子のみでtest/storybookを判定
 * __tests__フォルダ内のfixturesファイルを除外しないバージョン
 */
function isTestOrStorybookFileStrict(filePath: string): boolean {
  return /\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath);
}

describe("createFilteredSourceFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    // テスト用の一時ディレクトリを作成
    const project = new Project({ useInMemoryFileSystem: true });
    tempDir = "/test";

    // テスト用のファイルを作成
    project.createSourceFile(
      `${tempDir}/Component.tsx`,
      "export const Component = () => <div>Test</div>;",
    );
    project.createSourceFile(
      `${tempDir}/Component.test.tsx`,
      "export const TestComponent = () => <div>Test</div>;",
    );
    project.createSourceFile(
      `${tempDir}/Component.stories.tsx`,
      "export const Story = () => <div>Story</div>;",
    );
    project.createSourceFile(
      `${tempDir}/utils.ts`,
      "export const helper = () => {};",
    );

    // ファイルシステムに書き込み
    project.saveSync();
  });

  afterEach(() => {
    // クリーンアップは不要（メモリ内ファイルシステム）
  });

  it("指定したディレクトリのソースファイルを取得すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(
      sourceFiles.every((file) => file.getFilePath().includes(fixturesDir)),
    ).toBe(true);
  });

  it("testファイルを除外すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".test.")),
    ).toBe(true);
  });

  it("specファイルを除外すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".spec.")),
    ).toBe(true);
  });

  it("storyファイルを除外すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".stories.")),
    ).toBe(true);
  });

  it("デフォルトの除外パターンを全て適用すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(
      sourceFiles.every(
        (file) =>
          !file.getFilePath().includes(".test.") &&
          !file.getFilePath().includes(".stories.") &&
          !file.getFilePath().includes(".spec."),
      ),
    ).toBe(true);
  });

  it("TypeScriptとJavaScriptファイルを取得すること", () => {
    // Arrange
    const fixturesDir = path.join(__dirname, "..", "__tests__", "fixtures");

    // Act
    const sourceFiles = createFilteredSourceFiles(
      fixturesDir,
      isTestOrStorybookFileStrict,
    );

    // Assert
    expect(
      sourceFiles.every((file) => {
        const ext = path.extname(file.getFilePath());
        return [".ts", ".tsx", ".js", ".jsx"].includes(ext);
      }),
    ).toBe(true);
  });
});
