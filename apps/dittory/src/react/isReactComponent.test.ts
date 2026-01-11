import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { isReactComponent } from "@/react/isReactComponent";

describe("isReactComponent", () => {
  it("JSXを返すアロー関数をコンポーネントとして判定すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Button.tsx",
      `export const Button = () => <button>Click</button>;`,
    );

    // Act
    const declarations = sourceFile.getExportedDeclarations().get("Button");
    const result = declarations?.[0]
      ? isReactComponent(declarations[0])
      : false;

    // Assert
    expect(result).toBe(true);
  });

  it("JSXを返す関数宣言をコンポーネントとして判定すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Button.tsx",
      `export function Button() { return <button>Click</button>; }`,
    );

    // Act
    const declarations = sourceFile.getExportedDeclarations().get("Button");
    const result = declarations?.[0]
      ? isReactComponent(declarations[0])
      : false;

    // Assert
    expect(result).toBe(true);
  });

  it("JSXを返さない関数はコンポーネントではないと判定すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "utils.ts",
      `export const formatDate = () => new Date().toISOString();`,
    );

    // Act
    const declarations = sourceFile.getExportedDeclarations().get("formatDate");
    const result = declarations?.[0]
      ? isReactComponent(declarations[0])
      : false;

    // Assert
    expect(result).toBe(false);
  });

  it("React.memoでラップされたコンポーネントを判定すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "Button.tsx",
      `
      import { memo } from "react";
      export const Button = memo(() => <button>Click</button>);
      `,
    );

    // Act
    const declarations = sourceFile.getExportedDeclarations().get("Button");
    const result = declarations?.[0]
      ? isReactComponent(declarations[0])
      : false;

    // Assert
    expect(result).toBe(true);
  });

  it("オブジェクトのexportはコンポーネントではないと判定すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "config.ts",
      `export const Config = { theme: "dark", lang: "ja" };`,
    );

    // Act
    const declarations = sourceFile.getExportedDeclarations().get("Config");
    const result = declarations?.[0]
      ? isReactComponent(declarations[0])
      : false;

    // Assert
    expect(result).toBe(false);
  });
});
