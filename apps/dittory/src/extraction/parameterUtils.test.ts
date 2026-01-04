import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import type { ArgValue, CallSiteMap } from "./callSiteCollector";
import {
  argValueToKey,
  buildParameterPath,
  createParamRefValue,
  findContainingFunction,
  getFunctionName,
  isParameterReference,
  resolveParameterValue,
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
    expect(result).toBeDefined();
    expect(result?.getKind()).toBe(SyntaxKind.FunctionDeclaration);
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
    expect(result).toBeDefined();
    expect(result?.getKind()).toBe(SyntaxKind.ArrowFunction);
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
    expect(result).toBeDefined();
    expect(result?.getKind()).toBe(SyntaxKind.MethodDeclaration);
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
    expect(result.type).toBe("paramRef");
    if (result.type === "paramRef") {
      expect(result.filePath).toBe("/src/Component.tsx");
      expect(result.functionName).toBe("Component");
      expect(result.path).toBe("props.value");
    }
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
    expect(identifier).toBeDefined();
    if (!identifier) return;

    // Act
    const result = createParamRefValue(identifier);

    // Assert
    expect(result.type).toBe("literal");
    if (result.type === "literal") {
      expect(result.value).toBe("someValue");
    }
  });
});

describe("argValueToKey", () => {
  it("literal型の値を文字列キーに変換すること", () => {
    const value: ArgValue = { type: "literal", value: '"hello"' };
    expect(argValueToKey(value)).toBe('literal:"hello"');
  });

  it("function型の値を文字列キーに変換すること", () => {
    const value: ArgValue = {
      type: "function",
      filePath: "/src/file.ts",
      line: 10,
    };
    expect(argValueToKey(value)).toBe("function:/src/file.ts:10");
  });

  it("paramRef型の値を文字列キーに変換すること", () => {
    const value: ArgValue = {
      type: "paramRef",
      filePath: "/src/file.ts",
      functionName: "myFunc",
      path: "props.value",
    };
    expect(argValueToKey(value)).toBe(
      "paramRef:/src/file.ts:myFunc:props.value",
    );
  });

  it("undefined型の値を文字列キーに変換すること", () => {
    const value: ArgValue = { type: "undefined" };
    expect(argValueToKey(value)).toBe("undefined");
  });
});

describe("resolveParameterValue", () => {
  it("literal型の値はそのまま返すこと", () => {
    const callSiteMap: CallSiteMap = new Map();
    const value: ArgValue = { type: "literal", value: '"hello"' };
    expect(resolveParameterValue(value, callSiteMap)).toEqual(value);
  });

  it("undefined型の値はそのまま返すこと", () => {
    const callSiteMap: CallSiteMap = new Map();
    const value: ArgValue = { type: "undefined" };
    expect(resolveParameterValue(value, callSiteMap)).toEqual(value);
  });

  it("function型の値はそのまま返すこと", () => {
    const callSiteMap: CallSiteMap = new Map();
    const value: ArgValue = {
      type: "function",
      filePath: "/src/file.ts",
      line: 10,
    };
    expect(resolveParameterValue(value, callSiteMap)).toEqual(value);
  });

  it("すべての呼び出しで同じ値の場合は解決された値を返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/Parent.tsx:ParentComponent",
        new Map([
          [
            "number",
            [
              {
                name: "number",
                value: { type: "literal", value: "42" },
                filePath: "/src/App.tsx",
                line: 5,
              },
              {
                name: "number",
                value: { type: "literal", value: "42" },
                filePath: "/src/Page.tsx",
                line: 10,
              },
            ],
          ],
        ]),
      ],
    ]);

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/Parent.tsx",
      functionName: "ParentComponent",
      path: "props.number",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toEqual({ type: "literal", value: "42" });
  });

  it("異なる値がある場合はundefinedを返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/Parent.tsx:ParentComponent",
        new Map([
          [
            "number",
            [
              {
                name: "number",
                value: { type: "literal", value: "42" },
                filePath: "/src/App.tsx",
                line: 5,
              },
              {
                name: "number",
                value: { type: "literal", value: "100" },
                filePath: "/src/Page.tsx",
                line: 10,
              },
            ],
          ],
        ]),
      ],
    ]);

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/Parent.tsx",
      functionName: "ParentComponent",
      path: "props.number",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toBeUndefined();
  });

  it("再帰的にパラメータ参照を解決すること", () => {
    // Arrange: GrandChild -> Child -> Parent -> 最終値
    const callSiteMap: CallSiteMap = new Map();

    // GrandChildへの呼び出し: props.valueを渡している
    callSiteMap.set(
      "/src/GrandChild.tsx:GrandChild",
      new Map([
        [
          "value",
          [
            {
              name: "value",
              value: {
                type: "paramRef",
                filePath: "/src/Child.tsx",
                functionName: "Child",
                path: "props.innerValue",
              } as ArgValue,
              filePath: "/src/Child.tsx",
              line: 5,
            },
          ],
        ],
      ]),
    );

    // Childへの呼び出し
    callSiteMap.set(
      "/src/Child.tsx:Child",
      new Map([
        [
          "innerValue",
          [
            {
              name: "innerValue",
              value: {
                type: "paramRef",
                filePath: "/src/Parent.tsx",
                functionName: "Parent",
                path: "props.outerValue",
              } as ArgValue,
              filePath: "/src/Parent.tsx",
              line: 10,
            },
          ],
        ],
      ]),
    );

    // Parentへの呼び出し: 最終的なリテラル値
    callSiteMap.set(
      "/src/Parent.tsx:Parent",
      new Map([
        [
          "outerValue",
          [
            {
              name: "outerValue",
              value: { type: "literal", value: '"final"' } as ArgValue,
              filePath: "/src/App.tsx",
              line: 15,
            },
          ],
        ],
      ]),
    );

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/GrandChild.tsx",
      functionName: "GrandChild",
      path: "props.value",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toEqual({ type: "literal", value: '"final"' });
  });

  it("循環参照がある場合はundefinedを返すこと", () => {
    // Arrange: A -> B -> A (循環)
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/A.tsx:A",
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: {
                  type: "paramRef",
                  filePath: "/src/B.tsx",
                  functionName: "B",
                  path: "props.value",
                },
                filePath: "/src/B.tsx",
                line: 5,
              },
            ],
          ],
        ]),
      ],
      [
        "/src/B.tsx:B",
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: {
                  type: "paramRef",
                  filePath: "/src/A.tsx",
                  functionName: "A",
                  path: "props.value",
                },
                filePath: "/src/A.tsx",
                line: 10,
              },
            ],
          ],
        ]),
      ],
    ]);

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/A.tsx",
      functionName: "A",
      path: "props.value",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toBeUndefined();
  });

  it("呼び出し情報が見つからない場合はundefinedを返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map();

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/Unknown.tsx",
      functionName: "Unknown",
      path: "props.value",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toBeUndefined();
  });

  it("通常関数のパラメータ参照を解決すること", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/utils.ts:myFunction",
        new Map([
          [
            "arg",
            [
              {
                name: "arg",
                value: { type: "literal", value: '"constant"' },
                filePath: "/src/App.ts",
                line: 5,
              },
            ],
          ],
        ]),
      ],
    ]);

    const paramRef: ArgValue = {
      type: "paramRef",
      filePath: "/src/utils.ts",
      functionName: "myFunction",
      path: "arg",
    };

    // Act
    const result = resolveParameterValue(paramRef, callSiteMap);

    // Assert
    expect(result).toEqual({ type: "literal", value: '"constant"' });
  });
});
