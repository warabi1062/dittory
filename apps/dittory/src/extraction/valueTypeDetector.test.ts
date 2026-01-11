import { describe, expect, it } from "vitest";
import {
  BooleanLiteralArgValue,
  EnumLiteralArgValue,
  FunctionArgValue,
  NumberLiteralArgValue,
  ParamRefArgValue,
  StringLiteralArgValue,
  ThisLiteralArgValue,
  UndefinedArgValue,
  VariableLiteralArgValue,
} from "@/extraction/argValueClasses";
import {
  matchesValueTypes,
  VALID_VALUE_TYPES,
  type ValueType,
} from "./valueTypeDetector";

describe("matchesValueTypes", () => {
  describe("allが指定された場合", () => {
    it("任意の値に対してtrueを返すこと", () => {
      // Act & Assert
      expect(matchesValueTypes(new BooleanLiteralArgValue(true), "all")).toBe(
        true,
      );
      expect(matchesValueTypes(new NumberLiteralArgValue(42), "all")).toBe(
        true,
      );
      expect(matchesValueTypes(new StringLiteralArgValue("hello"), "all")).toBe(
        true,
      );
      expect(matchesValueTypes(new FunctionArgValue("/path", 42), "all")).toBe(
        true,
      );
    });
  });

  describe("種別配列が指定された場合", () => {
    it("booleanにマッチすること", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean"];

      // Act & Assert
      expect(
        matchesValueTypes(new BooleanLiteralArgValue(true), allowedTypes),
      ).toBe(true);
      expect(
        matchesValueTypes(new BooleanLiteralArgValue(false), allowedTypes),
      ).toBe(true);
    });

    it("numberにマッチすること", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["number"];

      // Act & Assert
      expect(
        matchesValueTypes(new NumberLiteralArgValue(42), allowedTypes),
      ).toBe(true);
      expect(
        matchesValueTypes(new NumberLiteralArgValue(-10), allowedTypes),
      ).toBe(true);
      expect(
        matchesValueTypes(new NumberLiteralArgValue(0), allowedTypes),
      ).toBe(true);
    });

    it("stringにマッチすること", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["string"];

      // Act & Assert
      expect(
        matchesValueTypes(new StringLiteralArgValue("hello"), allowedTypes),
      ).toBe(true);
      expect(
        matchesValueTypes(new StringLiteralArgValue(""), allowedTypes),
      ).toBe(true);
    });

    it("enumにマッチすること", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["enum"];

      // Act & Assert
      expect(
        matchesValueTypes(
          new EnumLiteralArgValue(
            "/path/to/file.ts",
            "Status",
            "Active",
            "active",
          ),
          allowedTypes,
        ),
      ).toBe(true);
      expect(
        matchesValueTypes(
          new EnumLiteralArgValue("/path/to/file.ts", "Priority", "High", 1),
          allowedTypes,
        ),
      ).toBe(true);
    });

    it("undefinedにマッチすること", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["undefined"];

      // Act & Assert
      expect(matchesValueTypes(new UndefinedArgValue(), allowedTypes)).toBe(
        true,
      );
    });

    it("複数種別が指定された場合、いずれかにマッチすればtrueを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number"];

      // Act & Assert
      expect(
        matchesValueTypes(new BooleanLiteralArgValue(true), allowedTypes),
      ).toBe(true);
      expect(
        matchesValueTypes(new NumberLiteralArgValue(42), allowedTypes),
      ).toBe(true);
    });

    it("指定された種別に一致しない値はfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number"];

      // Act & Assert
      expect(
        matchesValueTypes(new StringLiteralArgValue("hello"), allowedTypes),
      ).toBe(false);
      expect(matchesValueTypes(new UndefinedArgValue(), allowedTypes)).toBe(
        false,
      );
    });

    it("判定不能な値はfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = ["boolean", "number", "string"];

      // Act & Assert
      expect(
        matchesValueTypes(new FunctionArgValue("/path", 42), allowedTypes),
      ).toBe(false);
      expect(
        matchesValueTypes(
          new ParamRefArgValue("/path", "Comp", "props.x", 10),
          allowedTypes,
        ),
      ).toBe(false);
      expect(
        matchesValueTypes(
          new ThisLiteralArgValue("/path", 42, "this.prop"),
          allowedTypes,
        ),
      ).toBe(false);
      expect(
        matchesValueTypes(
          new VariableLiteralArgValue("/path", "VALUE", 1),
          allowedTypes,
        ),
      ).toBe(false);
    });

    it("空配列が指定された場合は常にfalseを返すこと", () => {
      // Arrange
      const allowedTypes: ValueType[] = [];

      // Act & Assert
      expect(
        matchesValueTypes(new BooleanLiteralArgValue(true), allowedTypes),
      ).toBe(false);
      expect(
        matchesValueTypes(new NumberLiteralArgValue(42), allowedTypes),
      ).toBe(false);
      expect(
        matchesValueTypes(new StringLiteralArgValue("hello"), allowedTypes),
      ).toBe(false);
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
