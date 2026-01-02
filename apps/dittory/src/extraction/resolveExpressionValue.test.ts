import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  resolveExpressionValue,
  UNDEFINED_VALUE,
} from "@/extraction/resolveExpressionValue";

describe("resolveExpressionValue", () => {
  it("文字列リテラルを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop="hello" />;`,
    );
    const stringLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.StringLiteral,
    );
    expect(stringLiteral).toBeDefined();
    if (!stringLiteral) return;

    // Act
    const result = resolveExpressionValue(stringLiteral);

    // Assert
    expect(result).toBe('"hello"');
  });

  it("数値リテラルを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop={42} />;`,
    );
    const numericLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.NumericLiteral,
    );
    expect(numericLiteral).toBeDefined();
    if (!numericLiteral) return;

    // Act
    const result = resolveExpressionValue(numericLiteral);

    // Assert
    expect(result).toBe("42");
  });

  it("真偽値リテラルを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop={true} />;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression = jsxExpression?.getExpression();
    expect(expression).toBeDefined();
    if (!expression) return;

    // Act
    const result = resolveExpressionValue(expression);

    // Assert
    expect(result).toBe("true");
  });

  it("真偽値の変数参照を解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      const isEnabled = true;
      const Component = () => <div prop={isEnabled} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = resolveExpressionValue(identifier);

    // Assert
    expect(result).toBe("true");
  });

  it("enumメンバーを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      enum Status {
        Active = "active",
        Inactive = "inactive"
      }
      const Component = () => <div status={Status.Active} />;
    `,
    );
    const propertyAccess = sourceFile
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((node) => node.getText() === "Status.Active");
    expect(propertyAccess).toBeDefined();
    if (!propertyAccess) return;

    // Act
    const result = resolveExpressionValue(propertyAccess);

    // Assert
    expect(result).toContain("Status.Active");
    expect(result).toContain('"active"');
  });

  it("変数参照を解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      const message = "hello";
      const Component = () => <div prop={message} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = resolveExpressionValue(identifier);

    // Assert
    expect(result).toBe('"hello"');
  });

  it("初期化されていない変数参照を解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      const Component = ({ message }: { message: string }) => <div prop={message} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = resolveExpressionValue(identifier);

    // Assert
    expect(result).toContain("message");
    expect(result).toContain(sourceFile.getFilePath());
  });

  it("undefinedを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop={undefined} />;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression = jsxExpression?.getExpression();
    expect(expression).toBeDefined();
    if (!expression) return;

    // Act
    const result = resolveExpressionValue(expression);

    // Assert
    expect(result).toBe(UNDEFINED_VALUE);
  });

  it("その他の式はテキストをそのまま返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = () => <div prop={1 + 2} />;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const binaryExpression = jsxExpression?.getExpression();
    expect(binaryExpression).toBeDefined();
    if (!binaryExpression) return;

    // Act
    const result = resolveExpressionValue(binaryExpression);

    // Assert
    expect(result).toBe("1 + 2");
  });
});
