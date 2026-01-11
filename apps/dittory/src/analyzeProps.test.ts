import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzePropsCore } from "@/analyzeProps";
import { CallSiteCollector } from "@/extraction/callSiteCollector";
import type { AnalysisResult } from "@/types";

// 共通フィクスチャコード
const BUTTON_VARIANT = `
export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
}
`;

const TEST_COMP = `
import type { ReactElement } from "react";
import type { ButtonVariant } from "./ButtonVariant";

export interface TestCompProps {
  label?: string;
  color?: string;
  disabled?: boolean;
  priority?: number;
  config?: {
    theme?: string;
    size?: number;
  };
  style?: {
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
  variant?: ButtonVariant;
  status?: any;
  onClick?: () => void;
}

export const TestComp = ({
  label,
  color,
  disabled,
  priority,
  config,
  style,
  variant,
  status,
  onClick,
}: TestCompProps): ReactElement => {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ color }}
      className={variant}
      onClick={onClick}
    >
      {label} ({priority}) {config?.theme} {config?.size}{" "}
      {style?.colors?.primary}/{style?.colors?.secondary} {String(status)}
    </button>
  );
};
`;

const STATUS_A = `
export enum Status {
  Active = "active_a",
  Inactive = "inactive_a",
}
`;

const STATUS_B = `
export enum Status {
  Active = "active_b",
  Inactive = "inactive_b",
}
`;

describe("analyzePropsCore", () => {
  it("常に同じ値が渡されているpropsを検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageConstant.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const Constant = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" color="blue" />
            <TestComp label="B" color="blue" />
            <TestComp label="C" color="blue" />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const colorProp = result.constantParams.find(
      (p) => p.paramName === "color",
    );
    if (!colorProp) {
      expect.unreachable("colorProp should be defined");
    }
    expect(colorProp.value.outputString()).toBe('"blue"');
    expect(colorProp.usages.length).toBe(3);
  });

  it("異なる値が渡されているpropsは検出しないこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageDifferent.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const Different = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" color="blue" />
            <TestComp label="B" color="red" />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const colorProp = result.constantParams.find(
      (p) => p.paramName === "color",
    );
    expect(colorProp).toBeUndefined();
  });

  it("optional propsのundefined値を考慮すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageOptional.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const Optional = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" color="blue" disabled={true} />
            <TestComp label="B" color="red" disabled={true} />
            <TestComp label="C" color="green" />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert - disabledは定数として検出されない
    const disabledProp = result.constantParams.find(
      (p) => p.paramName === "disabled",
    );
    expect(disabledProp).toBeUndefined();
  });

  it("異なるファイルで同名変数・異なる値の場合は別の値として扱うこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageConfigDifferent1.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      const config = { theme: "dark" };
      export const ConfigDifferent1 = (): ReactElement => {
        return <TestComp label="Page1" config={config} />;
      };
      `,
    );
    project.createSourceFile(
      "/src/UsageConfigDifferent2.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      const config = { theme: "light" };
      export const ConfigDifferent2 = (): ReactElement => {
        return <TestComp label="Page2" config={config} />;
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert - darkとlightが混在するため定数ではない
    const configTheme = result.constantParams.find(
      (p) => p.paramName === "config.theme",
    );
    expect(configTheme).toBeUndefined();
  });

  it("異なるファイルで同名変数・同じ値の場合は同じ値として扱うこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageConfigSame1.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const ConfigSame1 = (): ReactElement => {
        return <TestComp label="Page1" config={{ theme: "dark" }} />;
      };
      `,
    );
    project.createSourceFile(
      "/src/UsageConfigSame2.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const ConfigSame2 = (): ReactElement => {
        return <TestComp label="Page2" config={{ theme: "dark" }} />;
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const configTheme = result.constantParams.find(
      (p) => p.paramName === "config.theme",
    );
    if (!configTheme) {
      expect.unreachable("configTheme should be defined");
    }
    expect(configTheme.value.outputString()).toBe('"dark"');
  });

  it("異なるファイルで同名enumを使用した場合も別の値として扱うこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/StatusA.ts", STATUS_A);
    project.createSourceFile("/src/StatusB.ts", STATUS_B);
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageMixedStatus.tsx",
      `
      import type { ReactElement } from "react";
      import { Status as StatusA } from "./StatusA";
      import { Status as StatusB } from "./StatusB";
      import { TestComp } from "./TestComp";

      export const MixedStatus = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" status={StatusA.Active} />
            <TestComp label="B" status={StatusB.Active} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert - StatusAとStatusBは異なる値なので検出されない
    const statusProp = result.constantParams.find(
      (p) => p.paramName === "status",
    );
    expect(statusProp).toBeUndefined();
  });

  it("enumのpropsを検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageVariant.tsx",
      `
      import type { ReactElement } from "react";
      import { ButtonVariant } from "./ButtonVariant";
      import { TestComp } from "./TestComp";

      export const Variant = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" variant={ButtonVariant.Primary} />
            <TestComp label="B" variant={ButtonVariant.Primary} />
            <TestComp label="C" variant={ButtonVariant.Primary} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const variantProp = result.constantParams.find(
      (p) => p.paramName === "variant",
    );
    if (!variantProp) {
      expect.unreachable("variantProp should be defined");
    }
    expect(variantProp.value.outputString()).toBe("ButtonVariant.Primary");
    expect(variantProp.usages.length).toBe(3);
  });

  it("numberのpropsを検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageNumber.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const NumberProps = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" color="blue" priority={10} />
            <TestComp label="B" color="red" priority={10} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const priorityProp = result.constantParams.find(
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
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageNestedConstant.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const NestedConstant = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" config={{ theme: "dark", size: 10 }} />
            <TestComp label="B" config={{ theme: "dark", size: 10 }} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const themeProp = result.constantParams.find(
      (p) => p.paramName === "config.theme",
    );
    if (!themeProp) {
      expect.unreachable("themeProp should be defined");
    }
    expect(themeProp.value.outputString()).toBe('"dark"');
    expect(themeProp.usages.length).toBe(2);

    const sizeProp = result.constantParams.find(
      (p) => p.paramName === "config.size",
    );
    if (!sizeProp) {
      expect.unreachable("sizeProp should be defined");
    }
    expect(sizeProp.value.outputString()).toBe("10");
    expect(sizeProp.usages.length).toBe(2);

    // exported.usages にネストしたキーが存在することを確認
    const testComp = result.declarations.find((e) => e.name === "TestComp");
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
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageNestedDifferent.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const NestedDifferent = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" config={{ theme: "dark", size: 10 }} />
            <TestComp label="B" config={{ theme: "light", size: 20 }} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const themeProp = result.constantParams.find(
      (p) => p.paramName === "config.theme",
    );
    expect(themeProp).toBeUndefined();

    const sizeProp = result.constantParams.find(
      (p) => p.paramName === "config.size",
    );
    expect(sizeProp).toBeUndefined();
  });

  it("深くネストしたオブジェクトのプロパティを検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageDeepNested.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const DeepNested = (): ReactElement => {
        return (
          <div>
            <TestComp
              label="A"
              style={{ colors: { primary: "blue", secondary: "gray" } }}
            />
            <TestComp
              label="B"
              style={{ colors: { primary: "blue", secondary: "gray" } }}
            />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const primaryProp = result.constantParams.find(
      (p) => p.paramName === "style.colors.primary",
    );
    if (!primaryProp) {
      expect.unreachable("primaryProp should be defined");
    }
    expect(primaryProp.value.outputString()).toBe('"blue"');

    const secondaryProp = result.constantParams.find(
      (p) => p.paramName === "style.colors.secondary",
    );
    if (!secondaryProp) {
      expect.unreachable("secondaryProp should be defined");
    }
    expect(secondaryProp.value.outputString()).toBe('"gray"');
  });

  it("オブジェクト内のoptionalプロパティを考慮すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageOptionalNested.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      export const OptionalNested = (): ReactElement => {
        return (
          <div>
            <TestComp label="A" config={{ theme: "dark", size: 10 }} />
            <TestComp label="B" config={{ theme: "dark" }} />
          </div>
        );
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert
    const themeProp = result.constantParams.find(
      (p) => p.paramName === "config.theme",
    );
    if (!themeProp) {
      expect.unreachable("themeProp should be defined");
    }
    expect(themeProp.value.outputString()).toBe('"dark"');

    // sizeは片方にしかないため定数ではない
    const sizeProp = result.constantParams.find(
      (p) => p.paramName === "config.size",
    );
    expect(sizeProp).toBeUndefined();
  });

  it("関数型のpropsは定数として検出しないこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ButtonVariant.ts", BUTTON_VARIANT);
    project.createSourceFile("/src/TestComp.tsx", TEST_COMP);
    project.createSourceFile(
      "/src/UsageFunctionProp.tsx",
      `
      import type { ReactElement } from "react";
      import { TestComp } from "./TestComp";

      const handleClick = (): void => {
        console.log("clicked");
      };

      export const App1 = (): ReactElement => {
        return <TestComp label="Button1" onClick={handleClick} />;
      };

      export const App2 = (): ReactElement => {
        return <TestComp label="Button2" onClick={handleClick} />;
      };

      export const App3 = (): ReactElement => {
        return <TestComp label="Button3" onClick={handleClick} />;
      };
      `,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzePropsCore(sourceFiles, {
      callSiteMap,
    });

    // Assert - onClickは同じ関数が渡されているが、関数型なので検出されない
    const onClickProp = result.constantParams.find(
      (p) => p.paramName === "onClick",
    );
    expect(onClickProp).toBeUndefined();
  });
});
