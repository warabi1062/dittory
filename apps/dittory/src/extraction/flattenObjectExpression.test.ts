import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { CallSiteMap } from "@/extraction/callSiteMap";
import { flattenObjectExpression } from "@/extraction/flattenObjectExpression";
import {
  type ResolveContext,
  UNDEFINED_VALUE,
} from "@/extraction/resolveExpressionValue";

const emptyContext: ResolveContext = { callSiteMap: new CallSiteMap() };

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
    if (!objectLiteral) {
      expect.unreachable("objectLiteral should be defined");
    }

    // Act
    const result = flattenObjectExpression(
      objectLiteral,
      "style",
      emptyContext,
    );

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
    if (!objectLiteral) {
      expect.unreachable("objectLiteral should be defined");
    }

    // Act
    const result = flattenObjectExpression(
      objectLiteral,
      "config",
      emptyContext,
    );

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
    if (!objectLiteral) {
      expect.unreachable("objectLiteral should be defined");
    }

    // Act
    const result = flattenObjectExpression(
      objectLiteral,
      "style",
      emptyContext,
    );

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
    if (!stringLiteral) {
      expect.unreachable("stringLiteral should be defined");
    }

    // Act
    const result = flattenObjectExpression(stringLiteral, "prop", emptyContext);

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
    if (!objectLiteral) {
      expect.unreachable("objectLiteral should be defined");
    }

    // Act
    const result = flattenObjectExpression(objectLiteral, "", emptyContext);

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: "color", value: '"red"' },
        { key: "fontSize", value: "16" },
      ]),
    );
  });

  describe("省略されたプロパティの検出", () => {
    it("省略されたオプショナルプロパティを[undefined]として検出すること", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type Options = {
          url: string;
          method: string;
          config?: {
            timeout?: number;
          };
        };
        function request(options: Options) {}
        request({ url: "/api", method: "GET" });
        `,
      );
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("callExpression should be defined");
      }

      const objectLiteral = callExpression.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      if (!objectLiteral) {
        expect.unreachable("objectLiteral should be defined");
      }

      // Act
      const result = flattenObjectExpression(
        objectLiteral,
        "options",
        emptyContext,
      );

      // Assert
      expect(result).toEqual(
        expect.arrayContaining([
          { key: "options.url", value: '"/api"' },
          { key: "options.method", value: '"GET"' },
          { key: "options.config", value: UNDEFINED_VALUE },
        ]),
      );
    });

    it("省略された親プロパティのネストプロパティも検出すること", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type RequestOptions = {
          url: string;
          method: string;
          config?: {
            hoge?: undefined;
            timeout?: number;
            retries: number;
          };
        };
        function sendRequest(options: RequestOptions) {}
        sendRequest({ url: "/api/users", method: "GET" });
        `,
      );
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("callExpression should be defined");
      }

      const objectLiteral = callExpression.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      if (!objectLiteral) {
        expect.unreachable("objectLiteral should be defined");
      }

      // Act
      const result = flattenObjectExpression(
        objectLiteral,
        "options",
        emptyContext,
      );

      // Assert
      // config が省略されているので、config 自体と config.* のすべてのプロパティが [undefined] として検出される
      expect(result).toEqual(
        expect.arrayContaining([
          { key: "options.url", value: '"/api/users"' },
          { key: "options.method", value: '"GET"' },
          { key: "options.config", value: UNDEFINED_VALUE },
          { key: "options.config.hoge", value: UNDEFINED_VALUE },
          { key: "options.config.timeout", value: UNDEFINED_VALUE },
          { key: "options.config.retries", value: UNDEFINED_VALUE },
        ]),
      );
    });

    it("複数の省略されたプロパティを検出すること", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type Config = {
          a: string;
          b?: number;
          c?: boolean;
        };
        function configure(config: Config) {}
        configure({ a: "value" });
        `,
      );
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("callExpression should be defined");
      }

      const objectLiteral = callExpression.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      if (!objectLiteral) {
        expect.unreachable("objectLiteral should be defined");
      }

      // Act
      const result = flattenObjectExpression(
        objectLiteral,
        "config",
        emptyContext,
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          { key: "config.a", value: '"value"' },
          { key: "config.b", value: UNDEFINED_VALUE },
          { key: "config.c", value: UNDEFINED_VALUE },
        ]),
      );
    });

    it("ネストしたオブジェクトの省略プロパティを検出すること", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type RequestOptions = {
          url: string;
          method: string;
          config?: {
            hoge?: undefined;
            timeout?: number;
            retries: number;
          };
        };
        function sendRequest(options: RequestOptions) {}
        sendRequest({ url: "/api/posts", method: "GET", config: { retries: 3 } });
        `,
      );
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("callExpression should be defined");
      }

      const objectLiteral = callExpression.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      if (!objectLiteral) {
        expect.unreachable("objectLiteral should be defined");
      }

      // Act
      const result = flattenObjectExpression(
        objectLiteral,
        "options",
        emptyContext,
      );

      // Assert
      // config が渡されているが、config.hoge と config.timeout は省略されている
      expect(result).toEqual(
        expect.arrayContaining([
          { key: "options.url", value: '"/api/posts"' },
          { key: "options.method", value: '"GET"' },
          { key: "options.config.retries", value: "3" },
          { key: "options.config.hoge", value: UNDEFINED_VALUE },
          { key: "options.config.timeout", value: UNDEFINED_VALUE },
        ]),
      );
    });

    it("すべてのプロパティが渡されている場合は省略プロパティがないこと", () => {
      // Arrange
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type Point = {
          x: number;
          y: number;
        };
        function move(point: Point) {}
        move({ x: 10, y: 20 });
        `,
      );
      const callExpression = sourceFile.getFirstDescendantByKind(
        SyntaxKind.CallExpression,
      );
      if (!callExpression) {
        expect.unreachable("callExpression should be defined");
      }

      const objectLiteral = callExpression.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      if (!objectLiteral) {
        expect.unreachable("objectLiteral should be defined");
      }

      // Act
      const result = flattenObjectExpression(
        objectLiteral,
        "point",
        emptyContext,
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { key: "point.x", value: "10" },
          { key: "point.y", value: "20" },
        ]),
      );
    });
  });
});
