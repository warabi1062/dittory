import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { flattenObjectExpression } from "@/extraction/flattenObjectExpression";

describe("flattenObjectExpression", () => {
  it("オブジェクトリテラルをフラット化すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div style={{ color: "red", fontSize: 16 }} />;`,
    );
    const objectLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    expect(objectLiteral).toBeDefined();
    if (!objectLiteral) return;

    // Act
    const result = flattenObjectExpression(objectLiteral, "style");

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: "style.color", value: '"red"' },
        { key: "style.fontSize", value: "16" },
      ]),
    );
  });

  it("ネストしたオブジェクトリテラルを再帰的にフラット化すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div config={{ theme: { primary: "blue", secondary: "green" } }} />;`,
    );
    const objectLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    expect(objectLiteral).toBeDefined();
    if (!objectLiteral) return;

    // Act
    const result = flattenObjectExpression(objectLiteral, "config");

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: "config.theme.primary", value: '"blue"' },
        { key: "config.theme.secondary", value: '"green"' },
      ]),
    );
  });

  it("省略形プロパティを正しく処理すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      const Component = ({ color }: { color: string }) => {
        return <div style={{ color }} />;
      };
    `,
    );
    const objectLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    expect(objectLiteral).toBeDefined();
    if (!objectLiteral) return;

    // Act
    const result = flattenObjectExpression(objectLiteral, "style");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("style.color");
    // パラメータの場合はファイルパスと変数名で識別される
    expect(result[0].value).toContain("color");
    expect(result[0].value).toContain(sourceFile.getFilePath());
  });

  it("オブジェクトリテラル以外は単一の値として返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop="value" />;`,
    );
    const stringLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.StringLiteral,
    );
    expect(stringLiteral).toBeDefined();
    if (!stringLiteral) return;

    // Act
    const result = flattenObjectExpression(stringLiteral, "prop");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: "prop", value: '"value"' });
  });

  it("プレフィックスが空の場合も正しく動作すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const obj = { color: "red", fontSize: 16 };`,
    );
    const objectLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    expect(objectLiteral).toBeDefined();
    if (!objectLiteral) return;

    // Act
    const result = flattenObjectExpression(objectLiteral, "");

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: "color", value: '"red"' },
        { key: "fontSize", value: "16" },
      ]),
    );
  });
});
