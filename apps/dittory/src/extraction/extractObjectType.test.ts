import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { extractObjectType } from "./extractObjectType";

describe("extractObjectType", () => {
  it("オブジェクト型を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Obj = { a: number; b: string };
      const x: Obj = { a: 1, b: "hello" };
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.getProperties().map((p) => p.getName())).toEqual(["a", "b"]);
  });

  it("ユニオン型からundefinedを除外してオブジェクト型を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Obj = { a: number } | undefined;
      const x: Obj = { a: 1 };
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    // 型注釈から型を取得
    const typeNode = varDecl.getTypeNodeOrThrow();
    const type = typeNode.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.getProperties().map((p) => p.getName())).toEqual(["a"]);
  });

  it("ユニオン型からnullを除外してオブジェクト型を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Obj = { b: string } | null;
      const x: Obj = { b: "hello" };
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const typeNode = varDecl.getTypeNodeOrThrow();
    const type = typeNode.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.getProperties().map((p) => p.getName())).toEqual(["b"]);
  });

  it("ユニオン型からundefinedとnullを両方除外してオブジェクト型を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Obj = { c: boolean } | undefined | null;
      const x: Obj = { c: true };
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const typeNode = varDecl.getTypeNodeOrThrow();
    const type = typeNode.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.getProperties().map((p) => p.getName())).toEqual(["c"]);
  });

  it("文字列型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: string = "hello";
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("数値型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: number = 42;
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("boolean型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: boolean = true;
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("リテラル型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: "hello" = "hello";
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const typeNode = varDecl.getTypeNodeOrThrow();
    const type = typeNode.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("配列型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: number[] = [1, 2, 3];
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("プロパティを持たない空オブジェクト型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Empty = {};
      const x: Empty = {};
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("undefined型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: undefined = undefined;
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("null型に対してnullを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      const x: null = null;
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const type = varDecl.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).toBeNull();
  });

  it("ネストされたユニオン型からオブジェクト型を抽出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      type Inner = { nested: number } | undefined;
      type Outer = Inner | null;
      const x: Outer = { nested: 42 };
      `,
    );
    const varDecl = sourceFile.getVariableDeclarationOrThrow("x");
    const typeNode = varDecl.getTypeNodeOrThrow();
    const type = typeNode.getType();

    // Act
    const result = extractObjectType(type);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.getProperties().map((p) => p.getName())).toEqual(["nested"]);
  });
});
