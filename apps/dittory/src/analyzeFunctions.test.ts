import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { analyzeFunctionsCore } from "@/analyzeFunctions";
import { CallSiteCollector } from "@/extraction/callSiteCollector";
import type { AnalysisResult } from "@/types";

// ============================================================================
// Fixture定義
// ============================================================================

const TEST_FUNCTION = `
export function formatValue(
  value: string,
  prefix: string,
  suffix?: string,
): string {
  return \`\${prefix}\${value}\${suffix ?? ""}\`;
}

export const calculateSum = (
  a: number,
  b: number,
  multiplier?: number,
): number => {
  return (a + b) * (multiplier ?? 1);
};

export function processData(
  data: string,
  options: { uppercase: boolean; trim: boolean },
): string {
  let result = data;
  if (options.trim) {
    result = result.trim();
  }
  if (options.uppercase) {
    result = result.toUpperCase();
  }
  return result;
}
`;

const USAGE_FUNCTION_CONSTANT = `
import { formatValue } from "./testFunction";

// prefixが常に同じ値 "[INFO] " で呼ばれている
export const result1: string = formatValue("message1", "[INFO] ");
export const result2: string = formatValue("message2", "[INFO] ");
export const result3: string = formatValue("message3", "[INFO] ");
`;

const USAGE_FUNCTION_DIFFERENT = `
import { formatValue } from "./testFunction";

// prefixが異なる値で呼ばれている
export const result1: string = formatValue("message1", "[INFO] ");
export const result2: string = formatValue("message2", "[ERROR] ");
export const result3: string = formatValue("message3", "[WARN] ");
`;

const USAGE_FUNCTION_OPTIONAL = `
import { formatValue } from "./testFunction";

// suffixが一部で渡されていない
export const result1: string = formatValue("message1", "[INFO] ", "!");
export const result2: string = formatValue("message2", "[INFO] ");
export const result3: string = formatValue("message3", "[INFO] ", "!");
`;

const USAGE_FUNCTION_NUMBER = `
import { calculateSum } from "./testFunction";

// bが常に同じ値 100 で呼ばれている
export const result1: number = calculateSum(1, 100);
export const result2: number = calculateSum(2, 100);
export const result3: number = calculateSum(3, 100);
`;

const TEST_COMP = `
import type { ReactElement } from "react";

export interface TestCompProps {
  label?: string;
  color?: string;
}

export const TestComp = ({ label, color }: TestCompProps): ReactElement => {
  return <button type="button" style={{ color }}>{label}</button>;
};
`;

const USAGE_CONSTANT_TSX = `
import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const Constant = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" color="blue" />
      <TestComp label="B" color="blue" />
      <TestComp label="C" color="blue" />
    </div>
  );
};
`;

const TEST_CLASS = `
export class Logger {
  static log(message: string, level: string): void {
    console.log(\`[\${level}] \${message}\`);
  }

  static error(message: string): void {
    console.error(\`[ERROR] \${message}\`);
  }
}
`;

const USAGE_STATIC_METHOD = `
import { Logger } from "./testClass";

// levelが常に"DEBUG"で呼ばれている
Logger.log("message1", "DEBUG");
Logger.log("message2", "DEBUG");
Logger.log("message3", "DEBUG");
`;

const TEST_FUNCTION_WITH_CALLBACK = `
export function executeWithCallback(
  data: string,
  callback: () => void,
): string {
  callback();
  return data;
}
`;

const USAGE_FUNCTION_ARGUMENT = `
import { executeWithCallback } from "./testFunctionWithCallback";

const myCallback = (): void => {
  console.log("callback executed");
};

export function usage1(): void {
  executeWithCallback("data1", myCallback);
}

export function usage2(): void {
  executeWithCallback("data2", myCallback);
}

export function usage3(): void {
  executeWithCallback("data3", myCallback);
}
`;

const TEST_FUNCTION_WITH_OPTIONAL_NESTED = `
type RequestOptions = {
  url: string;
  method: string;
  config?: {
    timeout?: number;
    retries: number;
  };
};

export function sendRequest(options: RequestOptions): void {
  console.log(
    \`Sending \${options.method} request to \${options.url} with timeout \${options.config?.timeout}\`,
  );
}
`;

const USAGE_FUNCTION_OPTIONAL_NESTED = `
import { sendRequest } from "./testFunctionWithOptionalNested";

// configが未設定の呼び出し
sendRequest({
  url: "/api/users",
  method: "GET",
});
sendRequest({
  url: "/api/posts",
  method: "GET",
});

// configが設定されている呼び出し
sendRequest({
  url: "/api/comments",
  method: "GET",
  config: { timeout: 5000, retries: 2 },
});
sendRequest({
  url: "/api/tags",
  method: "GET",
  config: { timeout: 5000, retries: 3 },
});
`;

// ============================================================================
// テスト
// ============================================================================

/**
 * テスト用フィルター：拡張子のみでtest/storybookを判定
 * __tests__フォルダ内のfixturesファイルを除外しないバージョン
 */
function isTestOrStorybookFileStrict(filePath: string): boolean {
  return /\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath);
}

describe("analyzeFunctionsCore", () => {
  it("常に同じ値が渡されている引数を検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/testFunction.ts", TEST_FUNCTION);
    project.createSourceFile(
      "/usageFunctionConstant.ts",
      USAGE_FUNCTION_CONSTANT,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const prefixArg = result.constantParams.find(
      (a) => a.paramName === "prefix",
    );
    if (!prefixArg) {
      expect.unreachable("prefixArg should be defined");
    }
    expect(prefixArg.value.outputString()).toBe('"[INFO] "');
    expect(prefixArg.usages.length).toBe(3);
  });

  it("異なる値が渡されている引数は検出しないこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/testFunction.ts", TEST_FUNCTION);
    project.createSourceFile(
      "/usageFunctionDifferent.ts",
      USAGE_FUNCTION_DIFFERENT,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert
    const prefixArg = result.constantParams.find(
      (a) => a.paramName === "prefix",
    );
    expect(prefixArg).toBeUndefined();
  });

  it("optional引数のundefined値を考慮すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/testFunction.ts", TEST_FUNCTION);
    project.createSourceFile(
      "/usageFunctionOptional.ts",
      USAGE_FUNCTION_OPTIONAL,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - suffixは一部で渡されていないため定数として検出されない
    const suffixArg = result.constantParams.find(
      (a) => a.paramName === "suffix",
    );
    expect(suffixArg).toBeUndefined();

    // prefixは常に同じ値なので検出される
    const prefixArg = result.constantParams.find(
      (a) => a.paramName === "prefix",
    );
    if (!prefixArg) {
      expect.unreachable("prefixArg should be defined");
    }
    expect(prefixArg.value.outputString()).toBe('"[INFO] "');
  });

  it("numberの引数を検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/testFunction.ts", TEST_FUNCTION);
    project.createSourceFile("/usageFunctionNumber.ts", USAGE_FUNCTION_NUMBER);

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - bは常に100
    const bArg = result.constantParams.find((a) => a.paramName === "b");
    if (!bArg) {
      expect.unreachable("bArg should be defined");
    }
    expect(bArg.value.outputString()).toBe("100");
    expect(bArg.usages.length).toBe(3);
  });

  it("Reactコンポーネントは除外すること", () => {
    // Arrange
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { jsx: 2 }, // JsxEmit.React
    });
    project.createSourceFile("/TestComp.tsx", TEST_COMP);
    project.createSourceFile("/UsageConstant.tsx", USAGE_CONSTANT_TSX);

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - TestCompはReactコンポーネントなので関数として検出されない
    const testCompFunc = result.declarations.find((f) => f.name === "TestComp");
    expect(testCompFunc).toBeUndefined();
  });

  it("クラスのstaticメソッドを検出すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/testClass.ts", TEST_CLASS);
    project.createSourceFile("/usageStaticMethod.ts", USAGE_STATIC_METHOD);

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - Logger.logが検出される（名前は「ClassName.methodName」形式）
    const loggerLog = result.declarations.find((f) => f.name === "Logger.log");
    if (!loggerLog) {
      expect.unreachable("loggerLog should be defined");
    }

    // levelは常に"DEBUG"
    const levelArg = result.constantParams.find(
      (a) => a.declarationName === "Logger.log" && a.paramName === "level",
    );
    if (!levelArg) {
      expect.unreachable("levelArg should be defined");
    }
    expect(levelArg.value.outputString()).toBe('"DEBUG"');
    expect(levelArg.usages.length).toBe(3);
  });

  it("関数型の引数は定数として検出しないこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "/testFunctionWithCallback.ts",
      TEST_FUNCTION_WITH_CALLBACK,
    );
    project.createSourceFile(
      "/usageFunctionArgument.ts",
      USAGE_FUNCTION_ARGUMENT,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - callbackは同じ関数が渡されているが、関数型なので検出されない
    const callbackArg = result.constantParams.find(
      (a) => a.paramName === "callback",
    );
    expect(callbackArg).toBeUndefined();
  });

  it("一部の呼び出しでのみ存在するネストしたプロパティは定数として検出しないこと", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "/testFunctionWithOptionalNested.ts",
      TEST_FUNCTION_WITH_OPTIONAL_NESTED,
    );
    project.createSourceFile(
      "/usageFunctionOptionalNested.ts",
      USAGE_FUNCTION_OPTIONAL_NESTED,
    );

    // Act
    const sourceFiles = project.getSourceFiles();
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);
    const result: AnalysisResult = analyzeFunctionsCore(sourceFiles, {
      shouldExcludeFile: isTestOrStorybookFileStrict,
      callSiteMap,
    });

    // Assert - methodはすべての呼び出しで同じ値("GET")なので定数として検出される
    const methodArg = result.constantParams.find(
      (a) => a.paramName === "options.method",
    );
    if (!methodArg) {
      expect.unreachable("methodArg should be defined");
    }
    expect(methodArg.value.outputString()).toBe('"GET"');
    expect(methodArg.usages.length).toBe(4);

    // config.timeoutは一部の呼び出しでしか存在しないため定数として検出されない
    const timeoutArg = result.constantParams.find(
      (a) => a.paramName === "options.config.timeout",
    );
    expect(timeoutArg).toBeUndefined();

    // config.retriesも一部の呼び出しでしか存在しないため定数として検出されない
    const retriesArg = result.constantParams.find(
      (a) => a.paramName === "options.config.retries",
    );
    expect(retriesArg).toBeUndefined();

    // exported.usages にネストしたキーが "param.nested.key" 形式で存在することを確認
    const sendRequest = result.declarations.find(
      (e) => e.name === "sendRequest",
    );
    if (!sendRequest) {
      expect.unreachable("sendRequest should be defined");
    }
    expect(sendRequest.usages.get("options.method")).toBeDefined();
    expect(sendRequest.usages.get("options.method")?.[0].name).toBe(
      "options.method",
    );
  });
});
