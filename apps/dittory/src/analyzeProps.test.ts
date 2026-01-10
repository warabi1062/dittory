import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzePropsCore } from "@/analyzeProps";
import { collectCallSites } from "@/extraction/callSiteCollector";
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const colorProp = result.constants.find((p) => p.paramName === "color");
    expect(colorProp).toBeDefined();
    expect(colorProp?.value).toBe('"blue"');
    expect(colorProp?.valueType).toBe("string");
    expect(colorProp?.usages.length).toBe(3);

    // exported.usages の valueType もチェック
    const testComp = result.exported.find((e) => e.name === "TestComp");
    expect(testComp).toBeDefined();
    const colorUsages = testComp?.usages.color;
    expect(colorUsages).toBeDefined();
    expect(colorUsages?.every((u) => u.valueType === "string")).toBe(true);
  });

  it("異なる値が渡されているpropsは検出しないこと", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageDifferent.tsx"));

    // Act - Differentコンポーネントを使用
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - ConfigSame1とConfigSame2で同じ値のconfig
    const configTheme = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    expect(configTheme).toBeDefined();
    expect(configTheme?.value).toBe('"dark"');
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
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const variantProp = result.constants.find((p) => p.paramName === "variant");
    expect(variantProp).toBeDefined();
    expect(variantProp?.value).toContain("ButtonVariant.Primary");
    expect(variantProp?.value).toContain('"primary"');
    expect(variantProp?.valueType).toBe("enum");
    expect(variantProp?.usages.length).toBe(3);

    // exported.usages の valueType もチェック
    const testComp = result.exported.find((e) => e.name === "TestComp");
    expect(testComp).toBeDefined();
    const variantUsages = testComp?.usages.variant;
    expect(variantUsages).toBeDefined();
    expect(variantUsages?.every((u) => u.valueType === "enum")).toBe(true);
  });

  it("numberのpropsを検出すること", () => {
    // Arrange
    const project = new Project();
    project.addSourceFileAtPath(path.join(fixturesDir, "TestComp.tsx"));
    project.addSourceFileAtPath(path.join(fixturesDir, "UsageNumber.tsx"));

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - Numberコンポーネントでpriorityが常に10
    const priorityProp = result.constants.find(
      (p) => p.paramName === "priority",
    );
    expect(priorityProp).toBeDefined();
    expect(priorityProp?.value).toBe("10");
    expect(priorityProp?.valueType).toBe("number");
    expect(priorityProp?.usages.length).toBe(2);

    // exported.usages の valueType もチェック
    const testComp = result.exported.find((e) => e.name === "TestComp");
    expect(testComp).toBeDefined();
    const priorityUsages = testComp?.usages.priority;
    expect(priorityUsages).toBeDefined();
    expect(priorityUsages?.every((u) => u.valueType === "number")).toBe(true);
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - NestedConstantでconfig.themeとconfig.sizeが常に同じ値
    const themeProp = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    expect(themeProp).toBeDefined();
    expect(themeProp?.value).toBe('"dark"');
    expect(themeProp?.valueType).toBe("string");
    expect(themeProp?.usages.length).toBe(2);

    const sizeProp = result.constants.find(
      (p) => p.paramName === "config.size",
    );
    expect(sizeProp).toBeDefined();
    expect(sizeProp?.value).toBe("10");
    expect(sizeProp?.valueType).toBe("number");
    expect(sizeProp?.usages.length).toBe(2);

    // exported.usages にネストしたキーが "param.nested.key" 形式で存在することを確認
    const testComp = result.exported.find((e) => e.name === "TestComp");
    expect(testComp).toBeDefined();
    expect(testComp?.usages["config.theme"]).toBeDefined();
    expect(testComp?.usages["config.theme"][0].name).toBe("config.theme");
    expect(testComp?.usages["config.size"]).toBeDefined();
    expect(testComp?.usages["config.size"][0].name).toBe("config.size");
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
    const callSiteMap = collectCallSites(sourceFiles);
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - DeepNestedでstyle.colors.primaryとsecondaryが検出される
    const primaryProp = result.constants.find(
      (p) => p.paramName === "style.colors.primary",
    );
    expect(primaryProp).toBeDefined();
    expect(primaryProp?.value).toBe('"blue"');

    const secondaryProp = result.constants.find(
      (p) => p.paramName === "style.colors.secondary",
    );
    expect(secondaryProp).toBeDefined();
    expect(secondaryProp?.value).toBe('"gray"');
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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - OptionalNestedでconfig.themeは常に同じだがconfig.sizeは片方にしかない
    const themeProp = result.constants.find(
      (p) => p.paramName === "config.theme",
    );
    expect(themeProp).toBeDefined();
    expect(themeProp?.value).toBe('"dark"');

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
    const callSiteMap = collectCallSites(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - onClickは同じ関数が渡されているが、関数型なので検出されない
    const onClickProp = result.constants.find((p) => p.paramName === "onClick");
    expect(onClickProp).toBeUndefined();
  });
});
