import { describe, expect, it } from "vitest";
import { getSingleValueFromSet } from "@/utils/getSingleValueFromSet";

describe("getSingleValueFromSet", () => {
  it("Setに1つの値がある場合、その値を返すこと", () => {
    // Arrange
    const values = new Set(["value1"]);

    // Act
    const result = getSingleValueFromSet(values);

    // Assert
    expect(result).toBe("value1");
  });

  it("Setが空の場合、エラーをスローすること", () => {
    // Arrange
    const values = new Set<string>();

    // Act & Assert
    expect(() => getSingleValueFromSet(values)).toThrow(
      "Expected exactly 1 value, got 0",
    );
  });

  it("Setに複数の値がある場合、エラーをスローすること", () => {
    // Arrange
    const values = new Set(["value1", "value2"]);

    // Act & Assert
    expect(() => getSingleValueFromSet(values)).toThrow(
      "Expected exactly 1 value, got 2",
    );
  });

  it("異なる文字列値でも正しく動作すること", () => {
    // Arrange
    const values = new Set(['"blue"']);

    // Act
    const result = getSingleValueFromSet(values);

    // Assert
    expect(result).toBe('"blue"');
  });
});
