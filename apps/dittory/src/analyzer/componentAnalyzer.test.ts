import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { ComponentAnalyzer } from "@/analyzer/componentAnalyzer";
import { UndefinedArgValue } from "@/extraction/argValueClasses";
import { classifyDeclarations } from "@/source/classifyDeclarations";

/**
 * テスト用フィルター：拡張子のみでtest/storybookを判定
 * __tests__フォルダ内のfixturesファイルを除外しないバージョン
 */
function isTestOrStorybookFileStrict(filePath: string): boolean {
  return /\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath);
}

describe("ComponentAnalyzer", () => {
  it("exportされたコンポーネントを収集すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "Button.tsx",
      `
      export const Button = () => <button>Click</button>;
    `,
    );
    project.createSourceFile(
      "App.tsx",
      `
      export const App = () => <div>App</div>;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());

    // Act
    const result = analyzer.analyze(declarations);

    // Assert
    expect(result.exported.length).toBe(2);
    expect(result.exported.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Button", "App"]),
    );
  });

  it("Reactコンポーネントでないexportをスキップすること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "utils.tsx",
      `
      export const formatDate = () => new Date().toISOString();
      export const Config = { theme: "dark" };
      export const Button = () => <button>Click</button>;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());
    const components = declarations.filter((d) => d.type === "react");

    // Act
    const result = analyzer.analyze(components);

    // Assert
    expect(result.exported.length).toBe(1);
    expect(result.exported[0].name).toBe("Button");
  });

  it("optional propsの情報を含むこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "Button.tsx",
      `
      interface ButtonProps {
        label: string;
        color?: string;
      }
      export const Button = (props: ButtonProps) => <button>{props.label}</button>;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());

    // Act
    const result = analyzer.analyze(declarations);

    // Assert
    expect(result.exported.length).toBe(1);
    expect(result.exported[0].name).toBe("Button");
    const colorProp = result.exported[0].definitions.find(
      (p) => p.name === "color",
    );
    if (!colorProp) {
      expect.unreachable("colorProp should be defined");
    }
    expect(colorProp.required).toBe(false);
  });

  it("JSX属性からprops使用状況を抽出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "Button.tsx",
      `
      interface ButtonProps {
        color: string;
        size: string;
        disabled?: boolean;
      }
      export const Button = (props: ButtonProps) => <button>{props.color}</button>;
    `,
    );
    project.createSourceFile(
      "App.tsx",
      `
      import { Button } from "./Button";
      export const App = () => <Button color="blue" size="large" disabled />;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());

    // Act
    const result = analyzer.analyze(declarations);

    // Assert
    const button = result.exported.find((c) => c.name === "Button");
    if (!button) {
      expect.unreachable("button should be defined");
    }
    expect(button.usages.color).toHaveLength(1);
    expect(button.usages.color[0].value.outputString()).toBe('"blue"');
    expect(button.usages.size).toHaveLength(1);
    expect(button.usages.size[0].value.outputString()).toBe('"large"');
    expect(button.usages.disabled).toHaveLength(1);
    expect(button.usages.disabled[0].value.outputString()).toBe("true");
  });

  it("オブジェクトリテラルのpropsをネストして抽出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "Box.tsx",
      `
      interface BoxProps {
        style: { color: string; fontSize: number };
      }
      export const Box = (props: BoxProps) => <div style={props.style} />;
    `,
    );
    project.createSourceFile(
      "App.tsx",
      `
      import { Box } from "./Box";
      export const App = () => <Box style={{ color: "red", fontSize: 16 }} />;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());

    // Act
    const result = analyzer.analyze(declarations);

    // Assert
    const box = result.exported.find((c) => c.name === "Box");
    if (!box) {
      expect.unreachable("box should be defined");
    }
    expect(box.usages["style.color"]).toHaveLength(1);
    expect(box.usages["style.color"][0].value.outputString()).toBe('"red"');
    expect(box.usages["style.fontSize"]).toHaveLength(1);
    expect(box.usages["style.fontSize"][0].value.outputString()).toBe("16");
  });

  it("渡されていないpropsをundefinedとして記録すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "Button.tsx",
      `
      interface ButtonProps {
        color: string;
        size?: string;
      }
      export const Button = (props: ButtonProps) => <button>{props.color}</button>;
    `,
    );
    project.createSourceFile(
      "App.tsx",
      `
      import { Button } from "./Button";
      export const App = () => <Button color="blue" />;
    `,
    );
    const analyzer = new ComponentAnalyzer({
      shouldExcludeFile: isTestOrStorybookFileStrict,
    });
    const declarations = classifyDeclarations(project.getSourceFiles());

    // Act
    const result = analyzer.analyze(declarations);

    // Assert
    const button = result.exported.find((c) => c.name === "Button");
    if (!button) {
      expect.unreachable("button should be defined");
    }
    expect(button.usages.color).toHaveLength(1);
    expect(button.usages.color[0].value.outputString()).toBe('"blue"');
    expect(button.usages.size).toHaveLength(1);
    expect(button.usages.size[0].value).toBeInstanceOf(UndefinedArgValue);
  });
});
