import { describe, expect, it } from "vitest";
import type { ArgValue, CallSiteMap } from "./callSiteCollector";
import { argValueToKey, resolveParameterValue } from "./parameterUtils";

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
