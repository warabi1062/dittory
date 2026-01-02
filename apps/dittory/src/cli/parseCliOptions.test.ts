import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CliValidationError,
  getHelpMessage,
  parseCliOptions,
  validateTargetDir,
} from "./parseCliOptions";

describe("parseCliOptions", () => {
  describe("デフォルト値", () => {
    it("引数なしの場合はデフォルト値を返すこと", () => {
      // Arrange
      const args: string[] = [];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.targetDir).toBe(path.join(process.cwd(), "src"));
      expect(result.minUsages).toBe(2);
      expect(result.target).toBe("all");
      expect(result.showHelp).toBe(false);
    });
  });

  describe("--min オプション", () => {
    it("有効な値を指定した場合はその値を使用すること", () => {
      // Arrange
      const args = ["--min=5"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.minUsages).toBe(5);
    });

    it("値が空の場合はエラーを投げること", () => {
      // Arrange
      const args = ["--min="];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        '--min の値が無効です: "" (数値を指定してください)',
      );
    });

    it("数値でない場合はエラーを投げること", () => {
      // Arrange
      const args = ["--min=abc"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        '--min の値が無効です: "abc" (数値を指定してください)',
      );
    });

    it("1未満の場合はエラーを投げること", () => {
      // Arrange
      const args = ["--min=0"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        "--min の値は1以上である必要があります: 0",
      );
    });
  });

  describe("--target オプション", () => {
    it("allを指定した場合はallを使用すること", () => {
      // Arrange
      const args = ["--target=all"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.target).toBe("all");
    });

    it("componentsを指定した場合はcomponentsを使用すること", () => {
      // Arrange
      const args = ["--target=components"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.target).toBe("components");
    });

    it("functionsを指定した場合はfunctionsを使用すること", () => {
      // Arrange
      const args = ["--target=functions"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.target).toBe("functions");
    });

    it("無効な値を指定した場合はエラーを投げること", () => {
      // Arrange
      const args = ["--target=invalid"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        '--target の値が無効です: "invalid" (有効な値: all, components, functions)',
      );
    });
  });

  describe("--help オプション", () => {
    it("--helpを指定した場合はshowHelpがtrueになること", () => {
      // Arrange
      const args = ["--help"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.showHelp).toBe(true);
    });
  });

  describe("不明なオプション", () => {
    it("不明なオプションを指定した場合はエラーを投げること", () => {
      // Arrange
      const args = ["--unknown"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        "不明なオプション: --unknown",
      );
    });

    it("不明なオプションに値がある場合もエラーを投げること", () => {
      // Arrange
      const args = ["--unknown=value"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        "不明なオプション: --unknown",
      );
    });
  });

  describe("ディレクトリ引数", () => {
    it("ディレクトリを指定した場合はその値を使用すること", () => {
      // Arrange
      const args = ["/path/to/dir"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.targetDir).toBe("/path/to/dir");
    });

    it("複数のオプションとディレクトリを組み合わせて指定できること", () => {
      // Arrange
      const args = ["--min=3", "--target=components", "/custom/dir"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.minUsages).toBe(3);
      expect(result.target).toBe("components");
      expect(result.targetDir).toBe("/custom/dir");
    });
  });
});

describe("validateTargetDir", () => {
  const testDir = "/tmp/dittory-test-dir";
  const testFile = "/tmp/dittory-test-file";

  beforeEach(() => {
    // テスト用ディレクトリとファイルを作成
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, "test");
    }
  });

  afterEach(() => {
    // テスト用ディレクトリとファイルを削除
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it("存在するディレクトリの場合はエラーを投げないこと", () => {
    // Arrange & Act & Assert
    expect(() => validateTargetDir(testDir)).not.toThrow();
  });

  it("存在しないパスの場合はエラーを投げること", () => {
    // Arrange
    const nonExistentPath = "/non/existent/path";

    // Act & Assert
    expect(() => validateTargetDir(nonExistentPath)).toThrow(
      CliValidationError,
    );
    expect(() => validateTargetDir(nonExistentPath)).toThrow(
      `ディレクトリが存在しません: ${nonExistentPath}`,
    );
  });

  it("ファイルパスを指定した場合はエラーを投げること", () => {
    // Arrange & Act & Assert
    expect(() => validateTargetDir(testFile)).toThrow(CliValidationError);
    expect(() => validateTargetDir(testFile)).toThrow(
      `指定されたパスはディレクトリではありません: ${testFile}`,
    );
  });
});

describe("getHelpMessage", () => {
  it("ヘルプメッセージを返すこと", () => {
    // Arrange & Act
    const result = getHelpMessage();

    // Assert
    expect(result).toContain("Usage: dittory [options] [directory]");
    expect(result).toContain("--min=<number>");
    expect(result).toContain("--target=<mode>");
    expect(result).toContain("--help");
    expect(result).toContain("directory");
  });
});
