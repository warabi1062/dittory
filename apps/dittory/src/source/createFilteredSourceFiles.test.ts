import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilteredSourceFiles } from "@/source/createFilteredSourceFiles";

/**
 * テスト用フィルター：拡張子のみでtest/storybookを判定
 */
function isTestOrStorybookFileStrict(filePath: string): boolean {
  return /\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath);
}

describe("createFilteredSourceFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    // 一時ディレクトリを作成
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dittory-test-"));

    // テスト用のファイルを作成
    fs.writeFileSync(
      path.join(tempDir, "Component.tsx"),
      "export const Component = () => <div>Test</div>;",
    );
    fs.writeFileSync(
      path.join(tempDir, "Component.test.tsx"),
      "export const TestComponent = () => <div>Test</div>;",
    );
    fs.writeFileSync(
      path.join(tempDir, "Component.spec.tsx"),
      "export const SpecComponent = () => <div>Spec</div>;",
    );
    fs.writeFileSync(
      path.join(tempDir, "Component.stories.tsx"),
      "export const Story = () => <div>Story</div>;",
    );
    fs.writeFileSync(
      path.join(tempDir, "utils.ts"),
      "export const helper = () => {};",
    );
    fs.writeFileSync(
      path.join(tempDir, "helper.js"),
      "export const jsHelper = () => {};",
    );
  });

  afterEach(() => {
    // クリーンアップ
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("指定したディレクトリのソースファイルを取得すること", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(
      sourceFiles.every((file) => file.getFilePath().includes(tempDir)),
    ).toBe(true);
  });

  it("testファイルを除外すること", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".test.")),
    ).toBe(true);
  });

  it("specファイルを除外すること", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".spec.")),
    ).toBe(true);
  });

  it("storyファイルを除外すること", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    expect(
      sourceFiles.every((file) => !file.getFilePath().includes(".stories.")),
    ).toBe(true);
  });

  it("デフォルトの除外パターンを全て適用すること", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

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
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    expect(
      sourceFiles.every((file) => {
        const ext = path.extname(file.getFilePath());
        return [".ts", ".tsx", ".js", ".jsx"].includes(ext);
      }),
    ).toBe(true);
  });

  it("除外後に正しいファイル数を返すこと", () => {
    // Act
    const sourceFiles = createFilteredSourceFiles(tempDir, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });

    // Assert
    // Component.tsx, utils.ts, helper.js の3ファイルのみ
    expect(sourceFiles.length).toBe(3);
    const fileNames = sourceFiles.map((f) => path.basename(f.getFilePath()));
    expect(fileNames).toContain("Component.tsx");
    expect(fileNames).toContain("utils.ts");
    expect(fileNames).toContain("helper.js");
  });
});
