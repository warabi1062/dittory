import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { getProps } from "@/react/getProps";

describe("getProps", () => {
  it("interfaceからprops定義を抽出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      import type { ReactElement } from "react";

      interface ButtonProps {
        label: string;
        color?: string;
        disabled?: boolean;
        size: "small" | "medium" | "large";
      }

      export const Button = ({ label, color, disabled, size }: ButtonProps): ReactElement => {
        return <button>{label}</button>;
      };
    `,
    );

    // Act
    const exportedDecls = sourceFile.getExportedDeclarations();
    const buttonDecls = exportedDecls.get("Button");
    const buttonDecl = buttonDecls?.[0];
    if (!buttonDecl) throw new Error("Button declaration not found");

    const props = getProps(buttonDecl);

    // Assert
    expect(props).toHaveLength(4);
    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "label", required: true }),
        expect.objectContaining({ name: "color", required: false }),
        expect.objectContaining({ name: "disabled", required: false }),
        expect.objectContaining({ name: "size", required: true }),
      ]),
    );
    // indexが付与されていることを確認
    for (const prop of props) {
      expect(prop).toHaveProperty("index");
    }
  });

  it("type aliasからprops定義を抽出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      import type { ReactElement } from "react";

      type ButtonProps = {
        label: string;
        color?: string;
        disabled?: boolean;
      };

      export const Button = ({ label, color, disabled }: ButtonProps): ReactElement => {
        return <button>{label}</button>;
      };
    `,
    );

    // Act
    const exportedDecls = sourceFile.getExportedDeclarations();
    const buttonDecls = exportedDecls.get("Button");
    const buttonDecl = buttonDecls?.[0];
    if (!buttonDecl) throw new Error("Button declaration not found");

    const props = getProps(buttonDecl);

    // Assert
    expect(props).toHaveLength(3);
    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "label", required: true }),
        expect.objectContaining({ name: "color", required: false }),
        expect.objectContaining({ name: "disabled", required: false }),
      ]),
    );
  });

  it("Props interface/typeが存在しない場合は空配列を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      export const Button = () => <button>Click</button>;
    `,
    );

    // Act
    const exportedDecls = sourceFile.getExportedDeclarations();
    const buttonDecls = exportedDecls.get("Button");
    const buttonDecl = buttonDecls?.[0];
    if (!buttonDecl) throw new Error("Button declaration not found");

    const props = getProps(buttonDecl);

    // Assert
    expect(props).toHaveLength(0);
  });
});
