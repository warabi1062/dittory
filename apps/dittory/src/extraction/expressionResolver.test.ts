import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { CallSiteMap } from "@/extraction/callSiteMap";
import {
  ExpressionResolver,
  UNDEFINED_VALUE,
} from "@/extraction/expressionResolver";

const emptyResolver: ExpressionResolver = new ExpressionResolver(
  new CallSiteMap(),
);

describe("ExpressionResolver", () => {
  describe("resolve", () => {
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
      const result = emptyResolver.resolve(stringLiteral);

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
      const result = emptyResolver.resolve(numericLiteral);

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
      const result = emptyResolver.resolve(expression);

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
      const result = emptyResolver.resolve(identifier);

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
      const result = emptyResolver.resolve(propertyAccess);

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
      const result = emptyResolver.resolve(identifier);

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
      const result = emptyResolver.resolve(identifier);

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
      const result = emptyResolver.resolve(expression);

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
      const result = emptyResolver.resolve(binaryExpression);

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
      const result = emptyResolver.resolve(identifier);

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
      const result1 = emptyResolver.resolve(identifier1);
      const result2 = emptyResolver.resolve(identifier2);

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
      const result = emptyResolver.resolve(identifier);

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
      const result = emptyResolver.resolve(identifier);

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
      const result1 = emptyResolver.resolve(expression1);
      const result2 = emptyResolver.resolve(expression2);

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
      const result = emptyResolver.resolve(expression);

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
      const result1 = emptyResolver.resolve(thisAccess1);
      const result2 = emptyResolver.resolve(thisAccess2);

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
      const result = emptyResolver.resolve(thisAccess);

      // Assert
      expect(result).toContain("[this]");
      expect(result).toContain("this.nested.value");
    });
  });

  describe("flattenObject", () => {
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
      const result = emptyResolver.flattenObject(objectLiteral, "style");

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
      const result = emptyResolver.flattenObject(objectLiteral, "config");

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
      const result = emptyResolver.flattenObject(objectLiteral, "style");

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
      const result = emptyResolver.flattenObject(stringLiteral, "prop");

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
      const result = emptyResolver.flattenObject(objectLiteral, "");

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
        const result = emptyResolver.flattenObject(objectLiteral, "options");

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
            dummy?: undefined;
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
        const result = emptyResolver.flattenObject(objectLiteral, "options");

        // Assert
        // config が省略されているので、config 自体と config.* のすべてのプロパティが [undefined] として検出される
        expect(result).toEqual(
          expect.arrayContaining([
            { key: "options.url", value: '"/api/users"' },
            { key: "options.method", value: '"GET"' },
            { key: "options.config", value: UNDEFINED_VALUE },
            { key: "options.config.dummy", value: UNDEFINED_VALUE },
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
        const result = emptyResolver.flattenObject(objectLiteral, "config");

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
            dummy?: undefined;
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
        const result = emptyResolver.flattenObject(objectLiteral, "options");

        // Assert
        // config が渡されているが、config.dummy と config.timeout は省略されている
        expect(result).toEqual(
          expect.arrayContaining([
            { key: "options.url", value: '"/api/posts"' },
            { key: "options.method", value: '"GET"' },
            { key: "options.config.retries", value: "3" },
            { key: "options.config.dummy", value: UNDEFINED_VALUE },
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
        const result = emptyResolver.flattenObject(objectLiteral, "point");

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
});
