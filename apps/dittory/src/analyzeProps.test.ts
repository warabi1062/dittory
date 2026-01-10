import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzePropsCore } from "@/analyzeProps";
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

describe("analyzePropsCore", () => {
  it("常に同じ値が渡されているpropsを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageConstant.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const colorProp = result.constants.find((p) => p.paramName === "color");
    if (!colorProp) {
      expect.unreachable("colorProp should be defined");
    }
    expect(colorProp.value.outputString()).toBe('"blue"');
    expect(colorProp.usages.length).toBe(3);
  });

  it("異なる値が渡されているpropsは検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageDifferent.tsx"));

    // Act - Differentコンポーネントを使用
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - Differentは異なる値なのでcolorは定数ではない
    const colorProp = result.constants.find((p) => p.paramName === "color");
    expect(colorProp).toBeUndefined();
  });

  it("optional propsのundefined値を考慮すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageOptional.tsx"));

    // Act - Optionalコンポーネントを使用（disabledが2箇所でtrue、1箇所でundefined）
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - disabledは定数として検出されない
    const disabledProp = result.constants.find(
      (p) => p.paramName === "disabled",
    );
    expect(disabledProp).toBeUndefined();
  });

  it("異なるファイルで同名変数・異なる値の場合は別の値として扱うこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageConfigDifferent1.tsx"),
    );
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageConfigDifferent2.tsx"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - ConfigDifferent1とConfigDifferent2で異なる値のconfig
    const configTheme = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    // darkとlightが混在するため定数ではない
    expect(configTheme).toBeUndefined();
  });

  it("異なるファイルで同名変数・同じ値の場合は同じ値として扱うこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageConfigSame1.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageConfigSame2.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - ConfigSame1とConfigSame2で同じ値のconfig
    const configTheme = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    if (!configTheme) {
      expect.unreachable("configTheme should be defined");
    }
    expect(configTheme.value.outputString()).toBe('"dark"');
  });

  it("異なるファイルで同名enumを使用した場合も別の値として扱うこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "StatusA.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "StatusB.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageMixedStatus.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - StatusAとStatusBは異なる値なので検出されない
    const statusProp = result.constants.find((p) => p.paramName === "status");
    expect(statusProp).toBeUndefined();
  });

  it("異なるモジュールの同名enumを別の値として扱うこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "StatusA.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "StatusB.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageMixedStatus.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - MixedStatusでStatusAとStatusBが混在するため検出されない
    const statusProp = result.constants.find((p) => p.paramName === "status");
    expect(statusProp).toBeUndefined();
  });

  it("enumのpropsを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "ButtonVariant.ts"));
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageVariant.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const variantProp = result.constants.find((p) => p.paramName === "variant");
    if (!variantProp) {
      expect.unreachable("variantProp should be defined");
    }
    expect(variantProp.value.outputString()).toBe("ButtonVariant.Primary");
    expect(variantProp.usages.length).toBe(3);
  });

  it("numberのpropsを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageNumber.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - Numberコンポーネントでpriorityが常に10
    const priorityProp = result.constants.find(
      (p) => p.paramName === "priority",
    );
    if (!priorityProp) {
      expect.unreachable("priorityProp should be defined");
    }
    expect(priorityProp.value.outputString()).toBe("10");
    expect(priorityProp.usages.length).toBe(2);
  });

  it("オブジェクトリテラルpropsのネストしたプロパティを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageNestedConstant.tsx"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - NestedConstantでconfig.themeとconfig.sizeが常に同じ値
    const themeProp = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    if (!themeProp) {
      expect.unreachable("themeProp should be defined");
    }
    expect(themeProp.value.outputString()).toBe('"dark"');
    expect(themeProp.usages.length).toBe(2);

    const sizeProp = result.constants.find(
      (p) => p.paramName === "config.size",
    );
    if (!sizeProp) {
      expect.unreachable("sizeProp should be defined");
    }
    expect(sizeProp.value.outputString()).toBe("10");
    expect(sizeProp.usages.length).toBe(2);

    // exported.usages にネストしたキーが "param.nested.key" 形式で存在することを確認
    const testComp = result.exported.find((e) => e.name === "TestComp");
    if (!testComp) {
      expect.unreachable("testComp should be defined");
    }
    expect(testComp.usages["config.theme"]).toBeDefined();
    expect(testComp.usages["config.theme"][0].name).toBe("config.theme");
    expect(testComp.usages["config.size"]).toBeDefined();
    expect(testComp.usages["config.size"][0].name).toBe("config.size");
  });

  it("ネストしたオブジェクトの異なる値は検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageNestedDifferent.tsx"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - NestedDifferentでconfig.themeとconfig.sizeが異なる値
    const themeProp = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    expect(themeProp).toBeUndefined();

    const sizeProp = result.constants.find(
      (p) => p.paramName === "config.size",
    );
    expect(sizeProp).toBeUndefined();
  });

  it("深くネストしたオブジェクトのプロパティを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageDeepNested.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - DeepNestedでstyle.colors.primaryとsecondaryが検出される
    const primaryProp = result.constants.find(
      (p) => p.paramName === "style.colors.primary",
    );
    if (!primaryProp) {
      expect.unreachable("primaryProp should be defined");
    }
    expect(primaryProp.value.outputString()).toBe('"blue"');

    const secondaryProp = result.constants.find(
      (p) => p.paramName === "style.colors.secondary",
    );
    if (!secondaryProp) {
      expect.unreachable("secondaryProp should be defined");
    }
    expect(secondaryProp.value.outputString()).toBe('"gray"');
  });

  it("オブジェクト内のoptionalプロパティを考慮すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageOptionalNested.tsx"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - OptionalNestedでconfig.themeは常に同じだがconfig.sizeは片方にしかない
    const themeProp = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    if (!themeProp) {
      expect.unreachable("themeProp should be defined");
    }
    expect(themeProp.value.outputString()).toBe('"dark"');

    const sizeProp = result.constants.find(
      (p) => p.paramName === "config.size",
    );
    // sizeは片方にしかないため定数ではない
    expect(sizeProp).toBeUndefined();
  });

  it("関数型のpropsは定数として検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(
      path.join(fixturesDir, "UsageFunctionProp.tsx"),
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - onClickは同じ関数が渡されているが、関数型なので検出されない
    const onClickProp = result.constants.find((p) => p.paramName === "onClick");
    expect(onClickProp).toBeUndefined();
  });
});
