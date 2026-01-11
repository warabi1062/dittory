import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  FunctionArgValue,
  NumberLiteralArgValue,
  OtherLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
  UndefinedArgValue,
} from "@/domain/argValueClasses";
import { CallSiteInfo } from "@/domain/callSiteInfo";
import { CallSiteMap } from "@/domain/callSiteMap";
import { createParamRefValue, isParameterReference } from "./parameterUtils";

describe("isParameterReference", () => {
  it("関数パラメータを参照している場合はtrueを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `function fn(param: string) { return param; }`,
    );
    const returnStatement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ReturnStatement,
    );
    const identifier = returnStatement?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = isParameterReference(identifier);

    // Assert
    expect(result).toBe(true);
  });

  it("分割代入パターンのパラメータを参照している場合はtrueを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = ({ name }: { name: string }) => <div>{name}</div>;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const identifier = jsxExpression?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = isParameterReference(identifier);

    // Assert
    expect(result).toBe(true);
  });

  it("ローカル変数を参照している場合はfalseを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const value = 1; function fn() { return value; }`,
    );
    const returnStatement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ReturnStatement,
    );
    const identifier = returnStatement?.getExpression();
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = isParameterReference(identifier);

    // Assert
    expect(result).toBe(false);
  });

  it("props.xxxのようなPropertyAccessExpressionでもtrueを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.tsx",
      `const Component = (props: { name: string }) => <div>{props.name}</div>;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const propertyAccess = jsxExpression?.getExpression();
    expect(propertyAccess).toBeDefined();
    if (!propertyAccess) return;

    // Act - PropertyAccessExpression の左辺（props）がパラメータ参照かチェック
    const result = isParameterReference(
      propertyAccess
        .asKindOrThrow(SyntaxKind.PropertyAccessExpression)
        .getExpression(),
    );

    // Assert
    expect(result).toBe(true);
  });
});

describe("createParamRefValue", () => {
  it("アロー関数内のパラメータ参照からArgValueを作成すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/Component.tsx",
      `const Component = (props: { value: string }) => <div>{props.value}</div>;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression = jsxExpression?.getExpression();
    expect(expression).toBeDefined();
    if (!expression) return;

    // Act
    const result = createParamRefValue(expression);

    // Assert
    if (!(result instanceof ParamRefArgValue)) {
      expect.unreachable("result should be ParamRefArgValue");
    }
    expect(result.filePath).toBe("/src/Component.tsx");
    expect(result.functionName).toBe("Component");
    expect(result.path).toBe("props.value");
  });

  it("関数宣言内のパラメータ参照から関数名を取得すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/utils.ts",
      `function myFunction(param: string) { return param; }`,
    );
    const returnStatement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ReturnStatement,
    );
    const expression = returnStatement?.getExpression();
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = createParamRefValue(expression);

    // Assert
    if (!(result instanceof ParamRefArgValue)) {
      expect.unreachable("result should be ParamRefArgValue");
    }
    expect(result.functionName).toBe("myFunction");
    expect(result.path).toBe("param");
  });

  it("クラスメソッド内のパラメータ参照から「クラス名.メソッド名」形式で取得すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/service.ts",
      `class MyClass { myMethod(arg: number) { return arg; } }`,
    );
    const returnStatement = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ReturnStatement,
    );
    const expression = returnStatement?.getExpression();
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = createParamRefValue(expression);

    // Assert
    if (!(result instanceof ParamRefArgValue)) {
      expect.unreachable("result should be ParamRefArgValue");
    }
    expect(result.functionName).toBe("MyClass.myMethod");
    expect(result.path).toBe("arg");
  });

  it("無名関数内のパラメータ参照ではanonymousを含むこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/file.ts",
      `[1].map((x) => x * 2);`,
    );
    const binaryExpr = sourceFile.getFirstDescendantByKind(
      SyntaxKind.BinaryExpression,
    );
    const identifier = binaryExpr?.getLeft();
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = createParamRefValue(identifier);

    // Assert
    if (!(result instanceof ParamRefArgValue)) {
      expect.unreachable("result should be ParamRefArgValue");
    }
    expect(result.functionName).toBe("anonymous");
    expect(result.path).toBe("x");
  });

  it("ネストしたプロパティアクセスのパスを構築すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/Component.tsx",
      `const Component = (props: { nested: { deep: string } }) => <div>{props.nested.deep}</div>;`,
    );
    const jsxExpression = sourceFile.getFirstDescendantByKind(
      SyntaxKind.JsxExpression,
    );
    const expression = jsxExpression?.getExpression();
    if (!expression) {
      expect.unreachable("expression should be defined");
    }

    // Act
    const result = createParamRefValue(expression);

    // Assert
    if (!(result instanceof ParamRefArgValue)) {
      expect.unreachable("result should be ParamRefArgValue");
    }
    expect(result.path).toBe("props.nested.deep");
  });

  it("関数スコープが見つからない場合はliteral型を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "/src/file.ts",
      `const x = someValue;`,
    );
    const identifier = sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .find((id) => id.getText() === "someValue");
    if (!identifier) {
      expect.unreachable("identifier should be defined");
    }

    // Act
    const result = createParamRefValue(identifier);

    // Assert
    if (!(result instanceof OtherLiteralArgValue)) {
      expect.unreachable("result should be OtherLiteralArgValue");
    }
    expect(result.expression).toBe("someValue");
  });
});

describe("ArgValue.toKey", () => {
  it("literal型の値を文字列キーに変換すること", () => {
    const value = new StringLiteralArgValue("hello");
    expect(value.toKey()).toBe('[literal]"hello"');
  });

  it("function型の値を文字列キーに変換すること", () => {
    const value = new FunctionArgValue("/src/file.ts", 10);
    expect(value.toKey()).toBe("[function]/src/file.ts:10");
  });

  it("paramRef型の値を文字列キーに変換すること", () => {
    const value = new ParamRefArgValue(
      "/src/file.ts",
      "myFunc",
      "props.value",
      10,
    );
    expect(value.toKey()).toBe("[paramRef]/src/file.ts:myFunc:props.value");
  });

  it("undefined型の値を文字列キーに変換すること", () => {
    const value = new UndefinedArgValue();
    expect(value.toKey()).toBe("[undefined]");
  });
});

describe("ParamRefArgValue.resolve", () => {
  it("すべての呼び出しで同じ値の場合は解決された値を返すこと", () => {
    // Arrange
    const callSiteMap: Map<string, CallSiteInfo> = new Map([
      [
        "/src/Parent.tsx:ParentComponent",
        new CallSiteInfo(
          new Map([
            [
              "number",
              [
                {
                  name: "number",
                  value: new NumberLiteralArgValue(42),
                  filePath: "/src/App.tsx",
                  line: 5,
                },
                {
                  name: "number",
                  value: new NumberLiteralArgValue(42),
                  filePath: "/src/Page.tsx",
                  line: 10,
                },
              ],
            ],
          ]),
        ),
      ],
    ]);

    const paramRef = new ParamRefArgValue(
      "/src/Parent.tsx",
      "ParentComponent",
      "props.number",
      3,
    );

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(NumberLiteralArgValue);
    expect(result.outputString()).toBe("42");
  });

  it("異なる値がある場合はユニークな値を返すこと", () => {
    // Arrange
    const callSiteMap: Map<string, CallSiteInfo> = new Map([
      [
        "/src/Parent.tsx:ParentComponent",
        new CallSiteInfo(
          new Map([
            [
              "number",
              [
                {
                  name: "number",
                  value: new NumberLiteralArgValue(42),
                  filePath: "/src/App.tsx",
                  line: 5,
                },
                {
                  name: "number",
                  value: new NumberLiteralArgValue(100),
                  filePath: "/src/Page.tsx",
                  line: 10,
                },
              ],
            ],
          ]),
        ),
      ],
    ]);

    const paramRef = new ParamRefArgValue(
      "/src/Parent.tsx",
      "ParentComponent",
      "props.number",
      3,
    );

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(ParamRefArgValue);
    expect(result.toKey()).toContain("[paramRef]");
    expect(result.toKey()).toContain("/src/Parent.tsx");
  });

  it("再帰的にパラメータ参照を解決すること", () => {
    // Arrange: GrandChild -> Child -> Parent -> 最終値
    const callSiteMap: Map<string, CallSiteInfo> = new Map();

    // GrandChildへの呼び出し: props.valueを渡している
    callSiteMap.set(
      "/src/GrandChild.tsx:GrandChild",
      new CallSiteInfo(
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: new ParamRefArgValue(
                  "/src/Child.tsx",
                  "Child",
                  "props.innerValue",
                  5,
                ),
                filePath: "/src/Child.tsx",
                line: 5,
              },
            ],
          ],
        ]),
      ),
    );

    // Childへの呼び出し
    callSiteMap.set(
      "/src/Child.tsx:Child",
      new CallSiteInfo(
        new Map([
          [
            "innerValue",
            [
              {
                name: "innerValue",
                value: new ParamRefArgValue(
                  "/src/Parent.tsx",
                  "Parent",
                  "props.outerValue",
                  10,
                ),
                filePath: "/src/Parent.tsx",
                line: 10,
              },
            ],
          ],
        ]),
      ),
    );

    // Parentへの呼び出し: 最終的なリテラル値
    callSiteMap.set(
      "/src/Parent.tsx:Parent",
      new CallSiteInfo(
        new Map([
          [
            "outerValue",
            [
              {
                name: "outerValue",
                value: new StringLiteralArgValue("final"),
                filePath: "/src/App.tsx",
                line: 15,
              },
            ],
          ],
        ]),
      ),
    );

    const paramRef = new ParamRefArgValue(
      "/src/GrandChild.tsx",
      "GrandChild",
      "props.value",
      3,
    );

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(StringLiteralArgValue);
    expect(result.outputString()).toBe('"final"');
  });

  it("循環参照がある場合はユニークな値を返すこと", () => {
    // Arrange: A -> B -> A (循環)
    const callSiteMap: Map<string, CallSiteInfo> = new Map([
      [
        "/src/A.tsx:A",
        new CallSiteInfo(
          new Map([
            [
              "value",
              [
                {
                  name: "value",
                  value: new ParamRefArgValue(
                    "/src/B.tsx",
                    "B",
                    "props.value",
                    5,
                  ),
                  filePath: "/src/B.tsx",
                  line: 5,
                },
              ],
            ],
          ]),
        ),
      ],
      [
        "/src/B.tsx:B",
        new CallSiteInfo(
          new Map([
            [
              "value",
              [
                {
                  name: "value",
                  value: new ParamRefArgValue(
                    "/src/A.tsx",
                    "A",
                    "props.value",
                    10,
                  ),
                  filePath: "/src/A.tsx",
                  line: 10,
                },
              ],
            ],
          ]),
        ),
      ],
    ]);

    const paramRef = new ParamRefArgValue("/src/A.tsx", "A", "props.value", 3);

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(ParamRefArgValue);
    expect(result.toKey()).toContain("[paramRef]");
    expect(result.toKey()).toContain("/src/A.tsx");
  });

  it("呼び出し情報が見つからない場合はユニークな値を返すこと", () => {
    // Arrange
    const callSiteMap: Map<string, CallSiteInfo> = new Map();

    const paramRef = new ParamRefArgValue(
      "/src/Unknown.tsx",
      "Unknown",
      "props.value",
      3,
    );

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(ParamRefArgValue);
    expect(result.toKey()).toContain("[paramRef]");
    expect(result.toKey()).toContain("/src/Unknown.tsx");
  });

  it("通常関数のパラメータ参照を解決すること", () => {
    // Arrange
    const callSiteMap: Map<string, CallSiteInfo> = new Map([
      [
        "/src/utils.ts:myFunction",
        new CallSiteInfo(
          new Map([
            [
              "arg",
              [
                {
                  name: "arg",
                  value: new StringLiteralArgValue("constant"),
                  filePath: "/src/App.ts",
                  line: 5,
                },
              ],
            ],
          ]),
        ),
      ],
    ]);

    const paramRef = new ParamRefArgValue(
      "/src/utils.ts",
      "myFunction",
      "arg",
      3,
    );

    // Act
    const result = new CallSiteMap(callSiteMap).resolveParamRef(paramRef);

    // Assert
    expect(result).toBeInstanceOf(StringLiteralArgValue);
    expect(result.outputString()).toBe('"constant"');
  });
});
