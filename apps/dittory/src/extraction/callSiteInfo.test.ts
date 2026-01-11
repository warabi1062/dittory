import { describe, expect, it } from "vitest";
import {
  NumberLiteralArgValue,
  StringLiteralArgValue,
} from "./argValueClasses";
import { CallSiteInfo } from "./callSiteInfo";

describe("CallSiteInfo", () => {
  describe("get", () => {
    it("存在しないパラメータ名の場合undefinedを返すこと", () => {
      // Arrange
      const info = new CallSiteInfo();

      // Act
      const result = info.get("nonexistent");

      // Assert
      expect(result).toBeUndefined();
    });

    it("存在するパラメータ名の場合引数配列を返すこと", () => {
      // Arrange
      const info = new CallSiteInfo();
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("hello"),
        filePath: "/src/test.ts",
        line: 10,
      });

      // Act
      const result = info.get("arg1");

      // Assert
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(1);
      expect(result[0].value).toBeInstanceOf(StringLiteralArgValue);
    });
  });

  describe("set", () => {
    it("引数配列を設定できること", () => {
      // Arrange
      const info = new CallSiteInfo();
      const args = [
        {
          name: "arg1",
          value: new StringLiteralArgValue("value1"),
          filePath: "/src/test.ts",
          line: 10,
        },
        {
          name: "arg1",
          value: new StringLiteralArgValue("value2"),
          filePath: "/src/test.ts",
          line: 20,
        },
      ];

      // Act
      info.set("arg1", args);

      // Assert
      const result = info.get("arg1");
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(2);
    });

    it("既存の値を上書きできること", () => {
      // Arrange
      const info = new CallSiteInfo();
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("old"),
        filePath: "/src/test.ts",
        line: 10,
      });

      // Act
      info.set("arg1", [
        {
          name: "arg1",
          value: new StringLiteralArgValue("new"),
          filePath: "/src/test.ts",
          line: 20,
        },
      ]);

      // Assert
      const result = info.get("arg1");
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(1);
      const value = result[0].value;
      if (!(value instanceof StringLiteralArgValue)) {
        expect.unreachable("value should be StringLiteralArgValue");
      }
      expect(value.value).toBe("new");
    });
  });

  describe("addArg", () => {
    it("新しいパラメータ名に引数を追加できること", () => {
      // Arrange
      const info = new CallSiteInfo();

      // Act
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("hello"),
        filePath: "/src/test.ts",
        line: 10,
      });

      // Assert
      const result = info.get("arg1");
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(1);
    });

    it("既存のパラメータ名に引数を追加できること", () => {
      // Arrange
      const info = new CallSiteInfo();
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("first"),
        filePath: "/src/caller1.ts",
        line: 10,
      });

      // Act
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("second"),
        filePath: "/src/caller2.ts",
        line: 20,
      });

      // Assert
      const result = info.get("arg1");
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(2);
    });

    it("異なるパラメータ名に独立して引数を追加できること", () => {
      // Arrange
      const info = new CallSiteInfo();

      // Act
      info.addArg("arg1", {
        name: "arg1",
        value: new StringLiteralArgValue("value1"),
        filePath: "/src/test.ts",
        line: 10,
      });
      info.addArg("arg2", {
        name: "arg2",
        value: new NumberLiteralArgValue(42),
        filePath: "/src/test.ts",
        line: 10,
      });

      // Assert
      const result1 = info.get("arg1");
      const result2 = info.get("arg2");
      if (!result1 || !result2) {
        expect.unreachable("results should be defined");
      }
      expect(result1.length).toBe(1);
      expect(result2.length).toBe(1);
    });
  });

  describe("constructor", () => {
    it("初期マップを渡して初期化できること", () => {
      // Arrange
      const initialMap = new Map([
        [
          "arg1",
          [
            {
              name: "arg1",
              value: new StringLiteralArgValue("initial"),
              filePath: "/src/test.ts",
              line: 10,
            },
          ],
        ],
      ]);

      // Act
      const info = new CallSiteInfo(initialMap);

      // Assert
      const result = info.get("arg1");
      if (!result) {
        expect.unreachable("result should be defined");
      }
      expect(result.length).toBe(1);
    });
  });
});
