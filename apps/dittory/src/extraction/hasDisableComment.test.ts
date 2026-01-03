import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { hasDisableComment } from "./hasDisableComment";

describe("hasDisableComment", () => {
  it("直前に除外コメントがある場合はtrueを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// dittory-disable-next-line
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("マルチラインコメントでも検出できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
/* dittory-disable-next-line */
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("除外コメントがない場合はfalseを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(false);
  });

  it("関係ないコメントがある場合はfalseを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// some other comment
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(false);
  });

  it("子ノードからも祖先の除外コメントを検出できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// dittory-disable-next-line
const a = doSomething();
`.trim(),
    );
    // 関数呼び出し (CallExpression) を取得
    const callExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.CallExpression,
    );
    expect(callExpression).toBeDefined();
    if (!callExpression) return;

    // Act
    const result = hasDisableComment(callExpression);

    // Assert
    expect(result).toBe(true);
  });

  it("eslint-disable-next-lineと併用できること（eslintが先）", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// dittory-disable-next-line
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("eslint-disable-next-lineと併用できること（dittoryが先）", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// dittory-disable-next-line
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("@ts-ignoreと併用できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
// @ts-ignore
// dittory-disable-next-line
const a = 1;
`.trim(),
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("行末のdittory-disable-lineコメントを検出できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      "const a = 1; // dittory-disable-line",
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });

  it("子ノードからも祖先のdittory-disable-lineを検出できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      "const a = doSomething(); // dittory-disable-line",
    );
    const callExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.CallExpression,
    );
    expect(callExpression).toBeDefined();
    if (!callExpression) return;

    // Act
    const result = hasDisableComment(callExpression);

    // Assert
    expect(result).toBe(true);
  });

  it("eslint-disable-lineと併用できること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      "const a = 1; // eslint-disable-line @typescript-eslint/no-unused-vars -- dittory-disable-line",
    );
    const statement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableStatement,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // Act
    const result = hasDisableComment(statement);

    // Assert
    expect(result).toBe(true);
  });
});
