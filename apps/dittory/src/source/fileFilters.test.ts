import { describe, expect, it } from "vitest";
import { isTestOrStorybookFile } from "@/source/fileFilters";

describe("isTestOrStorybookFile", () => {
  it("テストファイルを判定すること", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/Component.test.ts")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.test.tsx")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.test.js")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.test.jsx")).toBe(true);
  });

  it("specファイルを判定すること", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/Component.spec.ts")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.spec.tsx")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.spec.js")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.spec.jsx")).toBe(true);
  });

  it("Storybookファイルを判定すること", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/Component.stories.ts")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.stories.tsx")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.stories.js")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/Component.stories.jsx")).toBe(true);
  });

  it("通常のファイルはfalseを返すこと", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/Component.ts")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/Component.tsx")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/Component.js")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/Component.jsx")).toBe(false);
  });

  it("拡張子が一致しない場合はfalseを返すこと", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/Component.test.css")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/Component.spec.md")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/Component.stories.json")).toBe(
      false,
    );
  });

  it("ファイル名に'test'や'stories'が含まれていても、拡張子が一致しなければfalseを返すこと", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/test/Component.ts")).toBe(false);
    expect(isTestOrStorybookFile("/path/to/stories/Component.tsx")).toBe(false);
  });

  it("__tests__フォルダ内のファイルはすべて除外対象となること", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/__tests__/Component.ts")).toBe(true);
    expect(isTestOrStorybookFile("/path/to/__tests__/Component.tsx")).toBe(
      true,
    );
    expect(isTestOrStorybookFile("/path/to/__tests__/helpers.js")).toBe(true);
  });

  it("__tests__フォルダ内のテストファイルは判定すること", () => {
    // Arrange & Act & Assert
    expect(isTestOrStorybookFile("/path/to/__tests__/Component.test.ts")).toBe(
      true,
    );
    expect(isTestOrStorybookFile("/path/to/__tests__/Component.spec.tsx")).toBe(
      true,
    );
  });
});
