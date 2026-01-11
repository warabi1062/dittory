import { describe, expect, it } from "vitest";
import {
  NumberLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
} from "@/domain/argValueClasses";
import { CallSiteMap } from "@/domain/callSiteMap";

describe("CallSiteMap", () => {
  describe("get", () => {
    it("存在しないtargetIdの場合undefinedを返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();

      // Act
      const result = callSiteMap.get("/src/test.ts:testFunc");

      // Assert
      expect(result).toBeUndefined();
    });

    it("存在するtargetIdの場合CallSiteInfoを返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg1",
        value: new StringLiteralArgValue("hello"),
        filePath: "/src/caller.ts",
        line: 10,
      });

      // Act
      const result = callSiteMap.get("/src/test.ts:testFunc");

      // Assert
      if (!result) {
        expect.unreachable("result should be defined");
      }
      const args = result.get("arg1");
      if (!args) {
        expect.unreachable("args should be defined");
      }
      expect(args.length).toBe(1);
      expect(args[0].value).toBeInstanceOf(StringLiteralArgValue);
    });
  });

  describe("addArg", () => {
    it("同じtargetIdに複数の引数を追加できること", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();

      // Act
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg1",
        value: new StringLiteralArgValue("first"),
        filePath: "/src/caller1.ts",
        line: 10,
      });
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg1",
        value: new StringLiteralArgValue("second"),
        filePath: "/src/caller2.ts",
        line: 20,
      });

      // Assert
      const info = callSiteMap.get("/src/test.ts:testFunc");
      if (!info) {
        expect.unreachable("info should be defined");
      }
      const args = info.get("arg1");
      if (!args) {
        expect.unreachable("args should be defined");
      }
      expect(args.length).toBe(2);
    });

    it("異なるパラメータ名の引数を追加できること", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();

      // Act
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg1",
        value: new StringLiteralArgValue("value1"),
        filePath: "/src/caller.ts",
        line: 10,
      });
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg2",
        value: new NumberLiteralArgValue(42),
        filePath: "/src/caller.ts",
        line: 10,
      });

      // Assert
      const info = callSiteMap.get("/src/test.ts:testFunc");
      if (!info) {
        expect.unreachable("info should be defined");
      }
      expect(info.get("arg1")).toBeDefined();
      expect(info.get("arg2")).toBeDefined();
    });
  });

  describe("resolveParamRef", () => {
    it("呼び出し情報がない場合ユニークな値を返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      const paramRef = new ParamRefArgValue(
        "/src/test.ts",
        "testFunc",
        "props.value",
        10,
      );

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result.toKey()).toContain("[paramRef]");
      expect(result.toKey()).toContain("/src/test.ts");
    });

    it("すべて同じ値が渡されている場合解決した値を返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "value",
        value: new StringLiteralArgValue("constant"),
        filePath: "/src/caller1.ts",
        line: 10,
      });
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "value",
        value: new StringLiteralArgValue("constant"),
        filePath: "/src/caller2.ts",
        line: 20,
      });
      const paramRef = new ParamRefArgValue(
        "/src/test.ts",
        "testFunc",
        "props.value",
        5,
      );

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result).toBeInstanceOf(StringLiteralArgValue);
      expect(result.outputString()).toBe('"constant"');
    });

    it("異なる値が渡されている場合ユニークな値を返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "value",
        value: new StringLiteralArgValue("first"),
        filePath: "/src/caller1.ts",
        line: 10,
      });
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "value",
        value: new StringLiteralArgValue("second"),
        filePath: "/src/caller2.ts",
        line: 20,
      });
      const paramRef = new ParamRefArgValue(
        "/src/test.ts",
        "testFunc",
        "props.value",
        5,
      );

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result.toKey()).toContain("[paramRef]");
    });

    it("ネストしたパラメータ参照を解決できること", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      // Parent -> Child の呼び出しでパラメータを転送
      callSiteMap.addArg("/src/Child.ts:Child", {
        name: "value",
        value: new ParamRefArgValue(
          "/src/Parent.ts",
          "Parent",
          "props.value",
          10,
        ),
        filePath: "/src/Parent.ts",
        line: 10,
      });
      // App -> Parent の呼び出しで実際の値を渡す
      callSiteMap.addArg("/src/Parent.ts:Parent", {
        name: "value",
        value: new StringLiteralArgValue("resolved"),
        filePath: "/src/App.ts",
        line: 5,
      });
      const paramRef = new ParamRefArgValue(
        "/src/Child.ts",
        "Child",
        "props.value",
        15,
      );

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result).toBeInstanceOf(StringLiteralArgValue);
      expect(result.outputString()).toBe('"resolved"');
    });

    it("循環参照がある場合ユニークな値を返すこと", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      // A -> B
      callSiteMap.addArg("/src/B.ts:B", {
        name: "value",
        value: new ParamRefArgValue("/src/A.ts", "A", "props.value", 10),
        filePath: "/src/A.ts",
        line: 10,
      });
      // B -> A（循環）
      callSiteMap.addArg("/src/A.ts:A", {
        name: "value",
        value: new ParamRefArgValue("/src/B.ts", "B", "props.value", 10),
        filePath: "/src/B.ts",
        line: 10,
      });
      const paramRef = new ParamRefArgValue("/src/A.ts", "A", "props.value", 5);

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result.toKey()).toContain("[paramRef]");
    });

    it("通常関数のパラメータパスを解決できること", () => {
      // Arrange
      const callSiteMap = new CallSiteMap();
      callSiteMap.addArg("/src/test.ts:testFunc", {
        name: "arg",
        value: new NumberLiteralArgValue(42),
        filePath: "/src/caller.ts",
        line: 10,
      });
      // 通常関数の場合はパスがそのまま引数名
      const paramRef = new ParamRefArgValue(
        "/src/test.ts",
        "testFunc",
        "arg",
        5,
      );

      // Act
      const result = callSiteMap.resolveParamRef(paramRef);

      // Assert
      expect(result).toBeInstanceOf(NumberLiteralArgValue);
      expect(result.outputString()).toBe("42");
    });
  });
});
