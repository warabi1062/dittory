import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CliValidationError,
  getHelpMessage,
  parseCliOptions,
  validateTargetDir,
  validateTsConfig,
} from "./parseCliOptions";

describe("parseCliOptions", () => {
  describe("引数なし", () => {
    it("引数なしの場合は showHelp のみ設定されること", () => {
      // Arrange
      const args: string[] = [];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.targetDir).toBeUndefined();
      expect(result.minUsages).toBeUndefined();
      expect(result.target).toBeUndefined();
      expect(result.output).toBeUndefined();
      expect(result.tsconfig).toBeUndefined();
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
        'Invalid value for --min: "" (must be a number)',
      );
    });

    it("数値でない場合はエラーを投げること", () => {
      // Arrange
      const args = ["--min=abc"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        'Invalid value for --min: "abc" (must be a number)',
      );
    });

    it("1未満の場合はエラーを投げること", () => {
      // Arrange
      const args = ["--min=0"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        "--min must be at least 1: 0",
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
        'Invalid value for --target: "invalid" (valid values: all, components, functions)',
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

  describe("--output オプション", () => {
    it("simpleを指定した場合はsimpleを使用すること", () => {
      // Arrange
      const args = ["--output=simple"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.output).toBe("simple");
    });

    it("verboseを指定した場合はverboseを使用すること", () => {
      // Arrange
      const args = ["--output=verbose"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.output).toBe("verbose");
    });

    it("無効な値を指定した場合はエラーを投げること", () => {
      // Arrange
      const args = ["--output=invalid"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        'Invalid value for --output: "invalid" (valid values: simple, verbose)',
      );
    });

    it("指定しない場合はundefinedであること", () => {
      // Arrange
      const args: string[] = [];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.output).toBeUndefined();
    });
  });

  describe("--tsconfig オプション", () => {
    it("パスを指定した場合はその値を使用すること", () => {
      // Arrange
      const args = ["--tsconfig=./config/tsconfig.json"];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.tsconfig).toBe("./config/tsconfig.json");
    });

    it("値が空の場合はエラーを投げること", () => {
      // Arrange
      const args = ["--tsconfig="];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow(
        "Invalid value for --tsconfig: path cannot be empty",
      );
    });

    it("デフォルト値はundefinedであること", () => {
      // Arrange
      const args: string[] = [];

      // Act
      const result = parseCliOptions(args);

      // Assert
      expect(result.tsconfig).toBeUndefined();
    });
  });

  describe("不明なオプション", () => {
    it("不明なオプションを指定した場合はエラーを投げること", () => {
      // Arrange
      const args = ["--unknown"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow("Unknown option: --unknown");
    });

    it("不明なオプションに値がある場合もエラーを投げること", () => {
      // Arrange
      const args = ["--unknown=value"];

      // Act & Assert
      expect(() => parseCliOptions(args)).toThrow(CliValidationError);
      expect(() => parseCliOptions(args)).toThrow("Unknown option: --unknown");
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
      `Directory does not exist: ${nonExistentPath}`,
    );
  });

  it("ファイルパスを指定した場合はエラーを投げること", () => {
    // Arrange & Act & Assert
    expect(() => validateTargetDir(testFile)).toThrow(CliValidationError);
    expect(() => validateTargetDir(testFile)).toThrow(
      `Path is not a directory: ${testFile}`,
    );
  });
});

describe("validateTsConfig", () => {
  const testTsConfig = "/tmp/dittory-test-tsconfig.json";

  beforeEach(() => {
    // テスト用 tsconfig.json を作成
    if (!fs.existsSync(testTsConfig)) {
      fs.writeFileSync(testTsConfig, "{}");
    }
  });

  afterEach(() => {
    // テスト用ファイルを削除
    if (fs.existsSync(testTsConfig)) {
      fs.unlinkSync(testTsConfig);
    }
  });

  it("存在するファイルの場合はエラーを投げないこと", () => {
    // Arrange & Act & Assert
    expect(() => validateTsConfig(testTsConfig)).not.toThrow();
  });

  it("存在しないファイルの場合はエラーを投げること", () => {
    // Arrange
    const nonExistentPath = "/non/existent/tsconfig.json";

    // Act & Assert
    expect(() => validateTsConfig(nonExistentPath)).toThrow(CliValidationError);
    expect(() => validateTsConfig(nonExistentPath)).toThrow(
      `tsconfig not found: ${nonExistentPath}`,
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
    expect(result).toContain("--tsconfig=<path>");
    expect(result).toContain("--help");
    expect(result).toContain("directory");
  });
});
