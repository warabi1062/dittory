import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzeFunctionsCore } from "@/analyzeFunctions";
import type { AnalysisResult } from "@/types";

const fixturesDir: string = path.join(__dirname, "__tests__", "fixtures");

/**
 * テスト用フィルター：拡張子のみでtest/storybookを判定
 * __tests__フォルダ内のfixturesファイルを除外しないバージョン
 */
function isTestOrStorybookFileStrict(filePath: string): boolean {
  return /\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath);
}

describe("analyzeFunctionsCore", () => {
  it("常に同じ値が渡されている引数を検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionConstant.ts"),
    );

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert
    const prefixArg = result.constants.find((a) => a.paramName === "prefix");
    expect(prefixArg).toBeDefined();
    expect(prefixArg?.value).toBe('"[INFO] "');
    expect(prefixArg?.usages.length).toBe(3);
  });

  it("異なる値が渡されている引数は検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionDifferent.ts"),
    );

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert
    const prefixArg = result.constants.find((a) => a.paramName === "prefix");
    expect(prefixArg).toBeUndefined();
  });

  it("optional引数のundefined値を考慮すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionOptional.ts"),
    );

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert - suffixは一部で渡されていないため定数として検出されない
    const suffixArg = result.constants.find((a) => a.paramName === "suffix");
    expect(suffixArg).toBeUndefined();

    // prefixは常に同じ値なので検出される
    const prefixArg = result.constants.find((a) => a.paramName === "prefix");
    expect(prefixArg).toBeDefined();
    expect(prefixArg?.value).toBe('"[INFO] "');
  });

  it("numberの引数を検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionNumber.ts"),
    );

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert - bは常に100
    const bArg = result.constants.find((a) => a.paramName === "b");
    expect(bArg).toBeDefined();
    expect(bArg?.value).toBe("100");
    expect(bArg?.usages.length).toBe(3);
  });

  it("Reactコンポーネントは除外すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageConstant.tsx"));

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert - TestCompはReactコンポーネントなので関数として検出されない
    const testCompFunc = result.exported.find((f) => f.name === "TestComp");
    expect(testCompFunc).toBeUndefined();
  });

  it("クラスのstaticメソッドを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testClass.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "usageStaticMethod.ts"));

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert - Logger.logが検出される（名前は「ClassName.methodName」形式）
    const loggerLog = result.exported.find((f) => f.name === "Logger.log");
    expect(loggerLog).toBeDefined();

    // levelは常に"DEBUG"
    const levelArg = result.constants.find(
      (a) => a.targetName === "Logger.log" && a.paramName === "level",
    );
    expect(levelArg).toBeDefined();
    expect(levelArg?.value).toBe('"DEBUG"');
    expect(levelArg?.usages.length).toBe(3);
  });

  it("関数型の引数は定数として検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(
      path.join(fixturesDir, "testFunctionWithCallback.ts"),
    );
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionArgument.ts"),
    );

    // Act
    const result: AnalysisResult = analyzeFunctionsCore(
      project.getSourceFiles(),
      {
        shouldExcludeFile: isTestOrStorybookFileStrict,
      },
    );

    // Assert - callbackは同じ関数が渡されているが、関数型なので検出されない
    const callbackArg = result.constants.find(
      (a) => a.paramName === "callback",
    );
    expect(callbackArg).toBeUndefined();
  });
});
