import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzeFunctionsCore } from "@/analyzeFunctions";
import { CallSiteCollector } from "@/extraction/callSiteCollector";
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
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const prefixArg = result.constants.find((a) => a.paramName === "prefix");
    if (!prefixArg) {
      expect.unreachable("prefixArg should be defined");
    }
    expect(prefixArg.value.outputString()).toBe('"[INFO] "');
    expect(prefixArg.usages.length).toBe(3);
  });

  it("異なる値が渡されている引数は検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionDifferent.ts"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

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
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - suffixは一部で渡されていないため定数として検出されない
    const suffixArg = result.constants.find((a) => a.paramName === "suffix");
    expect(suffixArg).toBeUndefined();

    // prefixは常に同じ値なので検出される
    const prefixArg = result.constants.find((a) => a.paramName === "prefix");
    if (!prefixArg) {
      expect.unreachable("prefixArg should be defined");
    }
    expect(prefixArg.value.outputString()).toBe('"[INFO] "');
  });

  it("numberの引数を検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "testFunction.ts"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionNumber.ts"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - bは常に100
    const bArg = result.constants.find((a) => a.paramName === "b");
    if (!bArg) {
      expect.unreachable("bArg should be defined");
    }
    expect(bArg.value.outputString()).toBe("100");
    expect(bArg.usages.length).toBe(3);
  });

  it("Reactコンポーネントは除外すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageConstant.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

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
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - Logger.logが検出される（名前は「ClassName.methodName」形式）
    const loggerLog = result.exported.find((f) => f.name === "Logger.log");
    if (!loggerLog) {
      expect.unreachable("loggerLog should be defined");
    }

    // levelは常に"DEBUG"
    const levelArg = result.constants.find(
      (a) => a.targetName === "Logger.log" && a.paramName === "level",
    );
    if (!levelArg) {
      expect.unreachable("levelArg should be defined");
    }
    expect(levelArg.value.outputString()).toBe('"DEBUG"');
    expect(levelArg.usages.length).toBe(3);
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
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - callbackは同じ関数が渡されているが、関数型なので検出されない
    const callbackArg = result.constants.find(
      (a) => a.paramName === "callback",
    );
    expect(callbackArg).toBeUndefined();
  });

  it("一部の呼び出しでのみ存在するネストしたプロパティは定数として検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(
      path.join(fixturesDir, "testFunctionWithOptionalNested.ts"),
    );
    project.addSourceFileAtPath(
      path.join(fixturesDir, "usageFunctionOptionalNested.ts"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - methodはすべての呼び出しで同じ値("GET")なので定数として検出される
    const methodArg = result.constants.find(
      (a) => a.paramName === "options.method",
    );
    if (!methodArg) {
      expect.unreachable("methodArg should be defined");
    }
    expect(methodArg.value.outputString()).toBe('"GET"');
    expect(methodArg.usages.length).toBe(4);

    // config.timeoutは一部の呼び出しでしか存在しないため定数として検出されない
    const timeoutArg = result.constants.find(
      (a) => a.paramName === "options.config.timeout",
    );
    expect(timeoutArg).toBeUndefined();

    // config.retriesも一部の呼び出しでしか存在しないため定数として検出されない
    const retriesArg = result.constants.find(
      (a) => a.paramName === "options.config.retries",
    );
    expect(retriesArg).toBeUndefined();

    // exported.usages にネストしたキーが "param.nested.key" 形式で存在することを確認
    const sendRequest = result.exported.find((e) => e.name === "sendRequest");
    if (!sendRequest) {
      expect.unreachable("sendRequest should be defined");
    }
    expect(sendRequest.usages["options.method"]).toBeDefined();
    expect(sendRequest.usages["options.method"][0].name).toBe("options.method");
  });
});
