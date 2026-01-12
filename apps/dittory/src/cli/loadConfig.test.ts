import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./loadConfig";

describe("loadConfig", () => {
  const originalCwd = process.cwd();
  const testDir = "/tmp/dittory-config-test";

  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    // 元のディレクトリに戻る
    process.chdir(originalCwd);

    // テストファイルを削除
    const files = [
      "dittory.config.json",
      "dittory.config.js",
      "dittory.config.mjs",
    ];
    for (const file of files) {
      const filePath = path.join(testDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  describe("JSON コンフィグ", () => {
    it("dittory.config.json を読み込むこと", async () => {
      // Arrange
      const config = { minUsages: 5, target: "components" };
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify(config),
      );

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.minUsages).toBe(5);
      expect(result.target).toBe("components");
    });

    it("無効な JSON の場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        "{ invalid json }",
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow("Failed to parse");
    });
  });

  describe("コンフィグファイルなし", () => {
    it("コンフィグファイルがない場合は空オブジェクトを返すこと", async () => {
      // Arrange - ファイルなし

      // Act
      const result = await loadConfig();

      // Assert
      expect(result).toEqual({});
    });
  });

  describe("バリデーション", () => {
    it("minUsages が数値でない場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ minUsages: "invalid" }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow(
        "minUsages must be a number >= 1",
      );
    });

    it("target が無効な値の場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ target: "invalid" }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow("target must be one of");
    });

    it("debug がブール値でない場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ debug: "invalid" }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow("debug must be a boolean");
    });

    it("valueTypes が無効な値の場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ valueTypes: "invalid" }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow(
        'valueTypes must be "all" or an array',
      );
    });

    it("valueTypes 配列に無効な種別が含まれる場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ valueTypes: ["boolean", "invalid"] }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow(
        'valueTypes contains invalid type "invalid"',
      );
    });
  });

  describe("valueTypes オプション", () => {
    it("valueTypes を配列として読み込むこと", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ valueTypes: ["boolean", "number"] }),
      );

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.allowedValueTypes).toEqual(["boolean", "number"]);
    });

    it("valueTypes を all として読み込むこと", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ valueTypes: "all" }),
      );

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.allowedValueTypes).toBe("all");
    });

    it("すべての有効な種別を読み込むこと", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({
          valueTypes: ["boolean", "number", "string", "enum", "undefined"],
        }),
      );

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.allowedValueTypes).toEqual([
        "boolean",
        "number",
        "string",
        "enum",
        "undefined",
      ]);
    });
  });

  describe("優先順位", () => {
    it("JS コンフィグが JSON より優先されること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ minUsages: 10 }),
      );
      fs.writeFileSync(
        path.join(testDir, "dittory.config.js"),
        "export default { minUsages: 5 };",
      );

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.minUsages).toBe(5);
    });
  });
});
