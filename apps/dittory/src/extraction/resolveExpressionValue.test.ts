import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  type ResolveContext,
  resolveExpressionValue,
  UNDEFINED_VALUE,
} from "@/extraction/resolveExpressionValue";

const emptyContext: ResolveContext = { callSiteMap: new Map() };

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
    if (!stringLiteral) {
      expect.unreachable("stringLiteral should be defined");
    }

    // Act
    const result = resolveExpressionValue(stringLiteral, emptyContext);

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
    if (!numericLiteral) {
      expect.unreachable("numericLiteral should be defined");
    }

    // Act
    const result = resolveExpressionValue(numericLiteral, emptyContext);

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
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = resolveExpressionValue(expression, emptyContext);

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
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

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
    if (!propertyAccess) {
      expect.unreachable("propertyAccess should be defined");
    }

    // Act
    const result = resolveExpressionValue(propertyAccess, emptyContext);

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
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

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
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

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
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = resolveExpressionValue(expression, emptyContext);

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
    if (!binaryExpression) {
      expect.unreachable("binaryExpression should be defined");
    }

    // Act
    const result = resolveExpressionValue(binaryExpression, emptyContext);

    // Assert
    expect(result).toBe("1 + 2");
  });

  it("インポートされた変数を元の定義で解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    // 定数を定義するファイル
    project.createSourceFile("constants.ts", `export const VALUE = 42;`);
    // 定数をインポートして使用するファイル
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      import { VALUE } from "./constants";
      const Component = () => <div prop={VALUE} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

    // Assert
    // インポート元の初期化子の値が解決される
    expect(result).toBe("42");
  });

  it("異なるファイルから同じ定数をインポートした場合に同じ値として解決されること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    // 定数を定義するファイル
    project.createSourceFile("constants.ts", `export const VALUE = 42;`);
    // 定数をインポートして使用するファイル1
    const sourceFile1 = project.createSourceFile(
      "test1.tsx",
      `
      import { VALUE } from "./constants";
      const Component1 = () => <div prop={VALUE} />;
    `,
    );
    // 定数をインポートして使用するファイル2
    const sourceFile2 = project.createSourceFile(
      "test2.tsx",
      `
      import { VALUE } from "./constants";
      const Component2 = () => <div prop={VALUE} />;
    `,
    );
    const jsxExpression1 = sourceFile1.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier1 = jsxExpression1?.getExpression();
    const jsxExpression2 = sourceFile2.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier2 = jsxExpression2?.getExpression();
    if (!identifier1 || !identifier2) {
      expect.unreachable("identifier1 and identifier2 should be defined");
    }

    // Act
    const result1 = resolveExpressionValue(identifier1, emptyContext);
    const result2 = resolveExpressionValue(identifier2, emptyContext);

    // Assert
    // 両方とも同じ値として解決される
    expect(result1).toBe("42");
    expect(result2).toBe("42");
    expect(result1).toBe(result2);
  });

  it("変数チェーンを再帰的に解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      const original = 100;
      const alias1 = original;
      const alias2 = alias1;
      const Component = () => <div prop={alias2} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

    // Assert
    // alias2 -> alias1 -> original -> 100 と辿って最終的な値が解決される
    expect(result).toBe("100");
  });

  it("インポートされた変数チェーンを解決すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    // 定数チェーンを定義するファイル
    project.createSourceFile(
      "constants.ts",
      `
      export const base = 42;
      export const derived = base;
      export const value = derived;
    `,
    );
    // 定数をインポートして使用するファイル
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      import { value } from "./constants";
      const Component = () => <div prop={value} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = resolveExpressionValue(identifier, emptyContext);

    // Assert
    // value -> derived -> base -> 42 と辿って最終的な値が解決される
    expect(result).toBe("42");
  });

  it("パラメータのプロパティアクセスは使用箇所ごとにユニークな値を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    // ParentA
    const sourceFile1 = project.createSourceFile(
      "ParentA.tsx",
      `
      type Props = { number: string };
      export const ParentA = (props: Props) => <div value={props.number} />;
    `,
    );
    // ParentB
    const sourceFile2 = project.createSourceFile(
      "ParentB.tsx",
      `
      type Props = { number: string };
      export const ParentB = (props: Props) => <div value={props.number} />;
    `,
    );
    const jsxExpression1 = sourceFile1.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression1 = jsxExpression1?.getExpression();
    const jsxExpression2 = sourceFile2.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression2 = jsxExpression2?.getExpression();
    if (!expression1 || !expression2) {
      expect.unreachable("expression1 and expression2 should be defined");
    }

    // Act
    const result1 = resolveExpressionValue(expression1, emptyContext);
    const result2 = resolveExpressionValue(expression2, emptyContext);

    // Assert
    // 同じ props.number でも、異なるファイルからの参照は異なる値として扱われる
    expect(result1).not.toBe(result2);
    expect(result1).toContain("paramRef:");
    expect(result2).toContain("paramRef:");
  });

  it("ネストしたパラメータプロパティアクセスも使用箇所ごとにユニークな値を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `
      type Props = { nested: { value: string } };
      export const Component = (props: Props) => <div prop={props.nested.value} />;
    `,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression = jsxExpression?.getExpression();
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = resolveExpressionValue(expression, emptyContext);

    // Assert
    // ネストしたプロパティアクセスでもパラメータ参照として認識される
    expect(result).toContain("paramRef:");
  });

  it("thisプロパティアクセスは使用箇所ごとにユニークな値を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile1 = project.createSourceFile(
      "ClassA.ts",
      `
      class ClassA {
        message: string;
        log() { console.log(this.message); }
      }
    `,
    );
    const sourceFile2 = project.createSourceFile(
      "ClassB.ts",
      `
      class ClassB {
        message: string;
        log() { console.log(this.message); }
      }
    `,
    );
    const thisAccess1 = sourceFile1
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((node) => node.getText() === "this.message");
    const thisAccess2 = sourceFile2
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((node) => node.getText() === "this.message");
    if (!thisAccess1 || !thisAccess2) {
      expect.unreachable("thisAccess1 and thisAccess2 should be defined");
    }

    // Act
    const result1 = resolveExpressionValue(thisAccess1, emptyContext);
    const result2 = resolveExpressionValue(thisAccess2, emptyContext);

    // Assert
    // 同じ this.message でも、異なるファイルからの参照は異なる値として扱われる
    expect(result1).not.toBe(result2);
    expect(result1).toContain("[this]");
    expect(result2).toContain("[this]");
  });

  it("ネストしたthisプロパティアクセスもユニークな値を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `
      class TestClass {
        nested: { value: string };
        log() { console.log(this.nested.value); }
      }
    `,
    );
    const thisAccess = sourceFile
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((node) => node.getText() === "this.nested.value");
    if (!thisAccess) {
      expect.unreachable("thisAccess should be defined");
    }

    // Act
    const result = resolveExpressionValue(thisAccess, emptyContext);

    // Assert
    expect(result).toContain("[this]");
    expect(result).toContain("this.nested.value");
  });
});
