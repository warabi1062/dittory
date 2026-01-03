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

    it("output が無効な値の場合はエラーを投げること", async () => {
      // Arrange
      fs.writeFileSync(
        path.join(testDir, "dittory.config.json"),
        JSON.stringify({ output: "invalid" }),
      );

      // Act & Assert
      await expect(loadConfig()).rejects.toThrow("output must be one of");
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
