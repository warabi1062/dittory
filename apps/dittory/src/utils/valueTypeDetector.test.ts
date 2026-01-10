import { describe, expect, it } from "vitest";
import { UNDEFINED_VALUE } from "@/extraction/expressionResolver";
import {
  detectValueType,
  matchesValueTypes,
  VALID_VALUE_TYPES,
  type ValueType,
} from "./valueTypeDetector";

describe("detectValueType", () => {
  describe("boolean", () => {
    it("trueをbooleanとして検出すること", () => {
      // Act
      const result = detectValueType("true");

      // Assert
      expect(result).toBe("boolean");
    });

    it("falseをbooleanとして検出すること", () => {
      // Act
      const result = detectValueType("false");

      // Assert
      expect(result).toBe("boolean");
    });
  });

  describe("number", () => {
    it("正の整数をnumberとして検出すること", () => {
      // Act
      const result = detectValueType("42");

      // Assert
      expect(result).toBe("number");
    });

    it("負の整数をnumberとして検出すること", () => {
      // Act
      const result = detectValueType("-10");

      // Assert
      expect(result).toBe("number");
    });

    it("小数をnumberとして検出すること", () => {
      // Act
      const result = detectValueType("3.14");

      // Assert
      expect(result).toBe("number");
    });

    it("0をnumberとして検出すること", () => {
      // Act
      const result = detectValueType("0");

      // Assert
      expect(result).toBe("number");
    });
  });

  describe("string", () => {
    it("ダブルクォート囲みの文字列をstringとして検出すること", () => {
      // Act
      const result = detectValueType('"hello"');

      // Assert
      expect(result).toBe("string");
    });

    it("空文字列をstringとして検出すること", () => {
      // Act
      const result = detectValueType('""');

      // Assert
      expect(result).toBe("string");
    });

    it("エスケープを含む文字列をstringとして検出すること", () => {
      // Act
      const result = detectValueType('"hello\\"world"');

      // Assert
      expect(result).toBe("string");
    });
  });

  describe("enum", () => {
    it("enum値をenumとして検出すること", () => {
      // Act
      const result = detectValueType('/path/to/file.ts:Status.Active="active"');

      // Assert
      expect(result).toBe("enum");
    });

    it("数値enumをenumとして検出すること", () => {
      // Act
      const result = detectValueType("/path/to/file.ts:Priority.High=1");

      // Assert
      expect(result).toBe("enum");
    });
  });

  describe("undefined", () => {
    it("UNDEFINED_VALUEをundefinedとして検出すること", () => {
      // Act
      const result = detectValueType(UNDEFINED_VALUE);

      // Assert
      expect(result).toBe("undefined");
    });
  });

  describe("判定不能なケース", () => {
    it("関数値はnullを返すこと", () => {
      // Act
      const result = detectValueType("[function]/path/to/file.ts:42");

      // Assert
      expect(result).toBeNull();
    });

    it("パラメータ参照はnullを返すこと", () => {
      // Act
      const result = detectValueType(
        "paramRef:/path/to/file.ts:Component:props.value",
      );

      // Assert
      expect(result).toBeNull();
    });

    it("this参照はnullを返すこと", () => {
      // Act
      const result = detectValueType("[this]/path/to/file.ts:42:this.prop");

      // Assert
      expect(result).toBeNull();
    });

    it("変数参照はnullを返すこと", () => {
      // Act
      const result = detectValueType("/path/to/constants.ts:VALUE");

      // Assert
      expect(result).toBeNull();
    });

    it("空文字列はnullを返すこと", () => {
      // Act
      const result = detectValueType("");

      // Assert
      expect(result).toBeNull();
    });
  });
});

describe("matchesValueTypes", () => {
  describe("allが指定された場合", () => {
    it("任意の値に対してtrueを返すこと", () => {
      // Act & Assert
      expect(matchesValueTypes("true", "all")).toBe(true);
      expect(matchesValueTypes("42", "all")).toBe(true);
      expect(matchesValueTypes('"hello"', "all")).toBe(true);
      expect(matchesValueTypes("[function]/path:42", "all")).toBe(true);
    });
  });

  describe("種別配列が指定された場合", () => {
    it("指定された種別に一致する値はtrueを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number"];

      // Act & Assert
      expect(matchesValueTypes("true", allowedTypes)).toBe(true);
      expect(matchesValueTypes("42", allowedTypes)).toBe(true);
    });

    it("指定された種別に一致しない値はfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number"];

      // Act & Assert
      expect(matchesValueTypes('"hello"', allowedTypes)).toBe(false);
      expect(matchesValueTypes(UNDEFINED_VALUE, allowedTypes)).toBe(false);
    });

    it("判定不能な値はfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number", "string"];

      // Act & Assert
      expect(matchesValueTypes("[function]/path:42", allowedTypes)).toBe(false);
      expect(
        matchesValueTypes("paramRef:/path:Comp:props.x", allowedTypes),
      ).toBe(false);
    });

    it("空配列が指定された場合は常にfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = [];

      // Act & Assert
      expect(matchesValueTypes("true", allowedTypes)).toBe(false);
      expect(matchesValueTypes("42", allowedTypes)).toBe(false);
      expect(matchesValueTypes('"hello"', allowedTypes)).toBe(false);
    });
  });
});

describe("VALID_VALUE_TYPES", () => {
  it("すべての有効な種別を含むこと", () => {
    // Assert
    expect(VALID_VALUE_TYPES).toContain("boolean");
    expect(VALID_VALUE_TYPES).toContain("number");
    expect(VALID_VALUE_TYPES).toContain("string");
    expect(VALID_VALUE_TYPES).toContain("enum");
    expect(VALID_VALUE_TYPES).toContain("undefined");
    expect(VALID_VALUE_TYPES).toHaveLength(5);
  });
});
