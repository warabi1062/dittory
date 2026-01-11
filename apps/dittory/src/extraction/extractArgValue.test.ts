import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  MethodCallLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
  VariableLiteralArgValue,
} from "@/domain/argValueClasses";
import { extractArgValue } from "./extractArgValue";

describe("extractArgValue", () => {
  describe("ShorthandPropertyAssignment", () => {
    it("for...ofの分割代入から来た変数を短縮プロパティで使用した場合、ParamRefArgValueを返すこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        const items = [{ name: "a" }, { name: "b" }];
        function process(items: { name: string }[]) {
          for (const { name } of items) {
            console.log({ name });
          }
        }
        `,
      );
      // 短縮プロパティ内の name 識別子を取得
      const shorthandProperty = sourceFile.getFirstDescendantByKind(
        SyntaxKind.ShorthandPropertyAssignment,
      );
      if (!shorthandProperty) {
        expect.unreachable("ShorthandPropertyAssignment not found");
      }
      const identifier = shorthandProperty.getNameNode();

      // Act
      const result = extractArgValue(identifier);

      // Assert
      expect(result).toBeInstanceOf(ParamRefArgValue);
      expect(result.toKey()).toContain("process");
      expect(result.toKey()).toContain("name");
    });

    it("変数宣言から来た変数を短縮プロパティで使用した場合、初期化子を解決すること", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        function process() {
          const value = "hello";
          console.log({ value });
        }
        `,
      );
      // 短縮プロパティ内の value 識別子を取得
      const shorthandProperty = sourceFile.getFirstDescendantByKind(
        SyntaxKind.ShorthandPropertyAssignment,
      );
      if (!shorthandProperty) {
        expect.unreachable("ShorthandPropertyAssignment not found");
      }
      const identifier = shorthandProperty.getNameNode();

      // Act
      const result = extractArgValue(identifier);

      // Assert
      // 初期化子 "hello" が解決されて StringLiteralArgValue になる
      expect(result).toBeInstanceOf(StringLiteralArgValue);
      expect(result.getValue()).toBe('"hello"');
    });
  });

  describe("CallExpression with parameter reference", () => {
    it("引数にパラメータ参照を含む関数呼び出しはMethodCallLiteralArgValueを返すこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        function transform(x: number) { return x; }
        function process(value: number) {
          return transform(value);
        }
        `,
      );
      // transform(value) の CallExpression を取得
      const callExpressions = sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression,
      );
      const transformCall = callExpressions.find((c) =>
        c.getText().startsWith("transform("),
      );
      if (!transformCall) {
        expect.unreachable("CallExpression not found");
      }

      // Act
      const result = extractArgValue(transformCall);

      // Assert
      expect(result).toBeInstanceOf(MethodCallLiteralArgValue);
      // 使用箇所ごとにユニークな値（行番号を含む）
      expect(result.toKey()).toContain("test.ts");
    });

    it("引数にパラメータ参照を含まない関数呼び出しはMethodCallLiteralArgValueを返さないこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        function transform(x: number) { return x; }
        function process() {
          return transform(42);
        }
        `,
      );
      // transform(42) の CallExpression を取得
      const callExpressions = sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression,
      );
      const transformCall = callExpressions.find((c) =>
        c.getText().startsWith("transform("),
      );
      if (!transformCall) {
        expect.unreachable("CallExpression not found");
      }

      // Act
      const result = extractArgValue(transformCall);

      // Assert
      // 引数がリテラルなのでMethodCallLiteralArgValueにはならない
      expect(result).not.toBeInstanceOf(MethodCallLiteralArgValue);
    });
  });

  describe("VariableLiteralArgValue with declaration line", () => {
    it("同名の異なるスコープの変数は異なるキーを持つこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        function process() {
          for (const item of [1, 2]) {
            console.log(item);
          }
          for (const item of [3, 4]) {
            console.log(item);
          }
        }
        `,
      );
      // 2つの item 識別子を取得（console.log内）
      const callExpressions = sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression,
      );
      const logCalls = callExpressions.filter((c) =>
        c.getText().startsWith("console.log"),
      );
      expect(logCalls.length).toBe(2);

      const firstItem = logCalls[0].getArguments()[0];
      const secondItem = logCalls[1].getArguments()[0];

      // Act
      const result1 = extractArgValue(firstItem);
      const result2 = extractArgValue(secondItem);

      // Assert
      // for...ofの変数はVariableLiteralArgValueになるが、
      // 宣言行番号が含まれるため、異なるスコープの同名変数は異なるキーを持つ
      expect(result1).toBeInstanceOf(VariableLiteralArgValue);
      expect(result2).toBeInstanceOf(VariableLiteralArgValue);
      expect(result1.toKey()).not.toBe(result2.toKey());
    });

    it("初期化子のない変数宣言は宣言行番号を含むキーを持つこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        declare const value1: string;
        declare const value2: string;
        function process() {
          console.log(value1, value2);
        }
        `,
      );
      // console.log の引数を取得
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("CallExpression not found");
      }
      const args = callExpression.getArguments();
      expect(args.length).toBe(2);

      // Act
      const result1 = extractArgValue(args[0]);
      const result2 = extractArgValue(args[1]);

      // Assert
      expect(result1).toBeInstanceOf(VariableLiteralArgValue);
      expect(result2).toBeInstanceOf(VariableLiteralArgValue);
      // 異なる行で宣言されているので異なるキーを持つ
      expect(result1.toKey()).not.toBe(result2.toKey());
      // キーに行番号が含まれている
      expect(result1.getValue()).toMatch(/:\d+:/);
      expect(result2.getValue()).toMatch(/:\d+:/);
    });
  });
});
