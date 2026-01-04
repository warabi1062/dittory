import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import type { CallSiteMap } from "./callSiteCollector";
import {
  buildParameterPath,
  createParameterRef,
  findContainingFunction,
  getFunctionName,
  isParameterReference,
  PARAM_REF_PREFIX,
  parseParameterRef,
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
    // return文の中のparamを取得
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
    // return文の中のvalueを取得
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
    // props.name の "props" 部分を取得
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

describe("parseParameterRef", () => {
  it("正しい形式のパラメータ参照をパースすること", () => {
    // Arrange
    const paramRef = "[param]/path/to/file.ts:myFunction:props.value";

    // Act
    const result = parseParameterRef(paramRef);

    // Assert
    expect(result).toEqual({
      filePath: "/path/to/file.ts",
      functionName: "myFunction",
      parameterPath: "props.value",
    });
  });

  it("ファイルパスにコロンが含まれる場合も正しくパースすること", () => {
    // Arrange (Windows風のパス)
    const paramRef = "[param]C:/Users/test/file.ts:myFunction:param";

    // Act
    const result = parseParameterRef(paramRef);

    // Assert
    expect(result).toEqual({
      filePath: "C:/Users/test/file.ts",
      functionName: "myFunction",
      parameterPath: "param",
    });
  });

  it("パラメータ参照でない文字列ではnullを返すこと", () => {
    // Arrange
    const notParamRef = "just a string";

    // Act
    const result = parseParameterRef(notParamRef);

    // Assert
    expect(result).toBeNull();
  });

  it("形式が不完全な場合はnullを返すこと", () => {
    // Arrange
    const incomplete = "[param]/path/to/file.ts:myFunction";

    // Act
    const result = parseParameterRef(incomplete);

    // Assert
    expect(result).toBeNull();
  });
});

describe("createParameterRef", () => {
  it("パラメータ参照文字列を作成すること", () => {
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
    const result = createParameterRef(expression);

    // Assert
    expect(result).toContain(PARAM_REF_PREFIX);
    expect(result).toContain("/src/Component.tsx");
    expect(result).toContain("Component");
    expect(result).toContain("props.value");
  });
});

describe("resolveParameterValue", () => {
  it("パラメータ参照でない値はそのまま返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map();

    // Act
    const result = resolveParameterValue('"hello"', callSiteMap);

    // Assert
    expect(result).toBe('"hello"');
  });

  it("すべての呼び出しで同じ値の場合は解決された値を返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/Child.tsx:Child",
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: '"constant"',
                filePath: "/src/App.tsx",
                line: 1,
              },
              {
                name: "value",
                value: '"constant"',
                filePath: "/src/App.tsx",
                line: 2,
              },
            ],
          ],
        ]),
      ],
    ]);

    // Act
    const result = resolveParameterValue(
      "[param]/src/Child.tsx:Child:props.value",
      callSiteMap,
    );

    // Assert
    expect(result).toBe('"constant"');
  });

  it("異なる値がある場合はundefinedを返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/Child.tsx:Child",
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: '"one"',
                filePath: "/src/App.tsx",
                line: 1,
              },
              {
                name: "value",
                value: '"two"',
                filePath: "/src/App.tsx",
                line: 2,
              },
            ],
          ],
        ]),
      ],
    ]);

    // Act
    const result = resolveParameterValue(
      "[param]/src/Child.tsx:Child:props.value",
      callSiteMap,
    );

    // Assert
    expect(result).toBeUndefined();
  });

  it("再帰的にパラメータ参照を解決すること", () => {
    // Arrange
    // App → Parent → Child の3階層で、すべて同じ値 "42" を渡す
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/Child.tsx:Child",
        new Map([
          [
            "number",
            [
              {
                name: "number",
                value: "[param]/src/Parent.tsx:Parent:props.number",
                filePath: "/src/Parent.tsx",
                line: 1,
              },
            ],
          ],
        ]),
      ],
      [
        "/src/Parent.tsx:Parent",
        new Map([
          [
            "number",
            [
              {
                name: "number",
                value: '"42"',
                filePath: "/src/App.tsx",
                line: 1,
              },
            ],
          ],
        ]),
      ],
    ]);

    // Act
    const result = resolveParameterValue(
      "[param]/src/Child.tsx:Child:props.number",
      callSiteMap,
    );

    // Assert
    expect(result).toBe('"42"');
  });

  it("循環参照がある場合はundefinedを返すこと", () => {
    // Arrange
    // A → B → A の循環参照
    const callSiteMap: CallSiteMap = new Map([
      [
        "/src/A.tsx:A",
        new Map([
          [
            "value",
            [
              {
                name: "value",
                value: "[param]/src/B.tsx:B:props.value",
                filePath: "/src/B.tsx",
                line: 1,
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
                value: "[param]/src/A.tsx:A:props.value",
                filePath: "/src/A.tsx",
                line: 1,
              },
            ],
          ],
        ]),
      ],
    ]);

    // Act
    const result = resolveParameterValue(
      "[param]/src/A.tsx:A:props.value",
      callSiteMap,
    );

    // Assert
    expect(result).toBeUndefined();
  });

  it("呼び出し情報が見つからない場合はundefinedを返すこと", () => {
    // Arrange
    const callSiteMap: CallSiteMap = new Map();

    // Act
    const result = resolveParameterValue(
      "[param]/src/Unknown.tsx:Unknown:props.value",
      callSiteMap,
    );

    // Assert
    expect(result).toBeUndefined();
  });
});
