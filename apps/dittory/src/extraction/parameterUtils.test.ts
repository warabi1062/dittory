import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  FunctionArgValue,
  NumberLiteralArgValue,
  OtherLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
  UndefinedArgValue,
} from "./argValueClasses";
import { CallSiteInfo } from "./callSiteInfo";
import { CallSiteMap } from "./callSiteMap";
import {
  buildParameterPath,
  createParamRefValue,
  findContainingFunction,
  getFunctionName,
  isParameterReference,
} from "./parameterUtils";

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

describe("findContainingFunction", () => {
  it("関数宣言を見つけること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `function myFunction() { const x = 1; }`,
    );
    const variableDecl = sourceFile.getFirstDescendantByKind(
      SyntaxKind.VariableDeclaration,
    );
    expect(variableDecl).toBeDefined();
    if (!variableDecl) return;

    // Act
    const result = findContainingFunction(variableDecl);

    // Assert
    if (!result) {
      expect.unreachable("result should be defined");
    }
    expect(result.getKind()).toBe(SyntaxKind.FunctionDeclaration);
  });

  it("アロー関数を見つけること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const myArrow = () => { const x = 1; };`,
    );
    const numericLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.NumericLiteral,
    );
    expect(numericLiteral).toBeDefined();
    if (!numericLiteral) return;

    // Act
    const result = findContainingFunction(numericLiteral);

    // Assert
    if (!result) {
      expect.unreachable("result should be defined");
    }
    expect(result.getKind()).toBe(SyntaxKind.ArrowFunction);
  });

  it("メソッド宣言を見つけること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `class MyClass { myMethod() { const x = 1; } }`,
    );
    const numericLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.NumericLiteral,
    );
    expect(numericLiteral).toBeDefined();
    if (!numericLiteral) return;

    // Act
    const result = findContainingFunction(numericLiteral);

    // Assert
    if (!result) {
      expect.unreachable("result should be defined");
    }
    expect(result.getKind()).toBe(SyntaxKind.MethodDeclaration);
  });

  it("関数外のノードではundefinedを返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("test.ts", `const x = 1;`);
    const numericLiteral = sourceFile.getFirstDescendantByKind(
      SyntaxKind.NumericLiteral,
    );
    expect(numericLiteral).toBeDefined();
    if (!numericLiteral) return;

    // Act
    const result = findContainingFunction(numericLiteral);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe("getFunctionName", () => {
  it("関数宣言から名前を取得すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `function myFunction() {}`,
    );
    const funcDecl = sourceFile.getFirstDescendantByKind(
      SyntaxKind.FunctionDeclaration,
    );
    expect(funcDecl).toBeDefined();
    if (!funcDecl) return;

    // Act
    const result = getFunctionName(funcDecl);

    // Assert
    expect(result).toBe("myFunction");
  });

  it("変数に代入されたアロー関数から名前を取得すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const myArrow = () => {};`,
    );
    const arrowFunc = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ArrowFunction,
    );
    expect(arrowFunc).toBeDefined();
    if (!arrowFunc) return;

    // Act
    const result = getFunctionName(arrowFunc);

    // Assert
    expect(result).toBe("myArrow");
  });

  it("クラスメソッドから「クラス名.メソッド名」形式で取得すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `class MyClass { myMethod() {} }`,
    );
    const methodDecl = sourceFile.getFirstDescendantByKind(
      SyntaxKind.MethodDeclaration,
    );
    expect(methodDecl).toBeDefined();
    if (!methodDecl) return;

    // Act
    const result = getFunctionName(methodDecl);

    // Assert
    expect(result).toBe("MyClass.myMethod");
  });

  it("無名関数では'anonymous'を返すこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("test.ts", `[1].map(() => 2);`);
    const arrowFunc = sourceFile.getFirstDescendantByKind(
      SyntaxKind.ArrowFunction,
    );
    expect(arrowFunc).toBeDefined();
    if (!arrowFunc) return;

    // Act
    const result = getFunctionName(arrowFunc);

    // Assert
    expect(result).toBe("anonymous");
  });
});

describe("buildParameterPath", () => {
  it("単純な識別子のパスを構築すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("test.ts", `const x = param;`);
    const identifier = sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .find((id) => id.getText() === "param");
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = buildParameterPath(identifier);

    // Assert
    expect(result).toBe("param");
  });

  it("ネストしたプロパティアクセスのパスを構築すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "test.ts",
      `const x = props.nested.value;`,
    );
    const propertyAccess = sourceFile.getFirstDescendantByKind(
      SyntaxKind.PropertyAccessExpression,
    );
    // 最も外側の PropertyAccessExpression を取得
    let outermost = propertyAccess;
    while (
      outermost?.getParent()?.getKind() === SyntaxKind.PropertyAccessExpression
    ) {
      outermost = outermost
        .getParent()
        ?.asKind(SyntaxKind.PropertyAccessExpression);
    }
    expect(outermost).toBeDefined();
    if (!outermost) return;

    // Act
    const result = buildParameterPath(outermost);

    // Assert
    expect(result).toBe("props.nested.value");
  });
});

describe("createParamRefValue", () => {
  it("パラメータ参照のArgValueを作成すること", () => {
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
