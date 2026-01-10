import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { ParamRefArgValue, StringLiteralArgValue } from "./argValue";
import { CallSiteCollector } from "./callSiteCollector";

describe("CallSiteCollector", () => {
  it("JSX要素からの呼び出し情報を収集すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });

    project.createSourceFile(
      "/src/Child.tsx",
      `
      type Props = { value: string };
      export const Child = (props: Props) => <div>{props.value}</div>;
    `,
    );

    project.createSourceFile(
      "/src/Parent.tsx",
      `
      import { Child } from "./Child";
      export const Parent = () => <Child value="hello" />;
    `,
    );

    const sourceFiles = project.getSourceFiles();

    // Act
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);

    // Assert
    const childTargetId = "/src/Child.tsx:Child";
    const childInfo = callSiteMap.get(childTargetId);

    if (!childInfo) {
      expect.unreachable("childInfo should be defined");
    }
    const valueUsages = childInfo.get("value");
    if (!valueUsages) {
      expect.unreachable("valueUsages should be defined");
    }
    expect(valueUsages.length).toBe(1);

    const value = valueUsages[0].value;
    if (!(value instanceof StringLiteralArgValue)) {
      expect.unreachable("value should be StringLiteralArgValue");
    }
    expect(value.value).toBe("hello");
  });

  it("パラメータ参照を含む呼び出し情報を収集すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });

    project.createSourceFile(
      "/src/Child.tsx",
      `
      type Props = { number: string };
      export const ChildComponent = (props: Props) => <div>{props.number}</div>;
    `,
    );

    project.createSourceFile(
      "/src/Parent.tsx",
      `
      import { ChildComponent } from "./Child";
      type Props = { number: string };
      export const ParentComponent = (props: Props) => {
        return <ChildComponent number={props.number} />;
      };
    `,
    );

    const sourceFiles = project.getSourceFiles();

    // Act
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);

    // Assert
    const childTargetId = "/src/Child.tsx:ChildComponent";
    const childInfo = callSiteMap.get(childTargetId);

    if (!childInfo) {
      expect.unreachable("childInfo should be defined");
    }
    const numberUsages = childInfo.get("number");
    if (!numberUsages) {
      expect.unreachable("numberUsages should be defined");
    }
    expect(numberUsages.length).toBe(1);

    const value = numberUsages[0].value;
    if (!(value instanceof ParamRefArgValue)) {
      expect.unreachable("value should be ParamRefArgValue");
    }
    expect(value.filePath).toBe("/src/Parent.tsx");
    expect(value.functionName).toBe("ParentComponent");
    expect(value.path).toBe("props.number");
  });

  it("親コンポーネントへの呼び出し情報も収集すること", () => {
    // Arrange
    const project = new Project({ useInMemoryFileSystem: true });

    project.createSourceFile(
      "/src/Child.tsx",
      `
      type Props = { number: string };
      export const ChildComponent = (props: Props) => <div>{props.number}</div>;
    `,
    );

    project.createSourceFile(
      "/src/Parent.tsx",
      `
      import { ChildComponent } from "./Child";
      type Props = { number: string };
      export const ParentComponent = (props: Props) => {
        return <ChildComponent number={props.number} />;
      };
    `,
    );

    project.createSourceFile(
      "/src/App.tsx",
      `
      import { ParentComponent } from "./Parent";
      export const App = () => {
        return <ParentComponent number="42" />;
      };
    `,
    );

    const sourceFiles = project.getSourceFiles();

    // Act
    const callSiteMap = new CallSiteCollector().collect(sourceFiles);

    // Assert
    const parentTargetId = "/src/Parent.tsx:ParentComponent";
    const parentInfo = callSiteMap.get(parentTargetId);

    if (!parentInfo) {
      expect.unreachable("parentInfo should be defined");
    }
    const numberUsages = parentInfo.get("number");
    if (!numberUsages) {
      expect.unreachable("numberUsages should be defined");
    }
    expect(numberUsages.length).toBe(1);

    const value = numberUsages[0].value;
    if (!(value instanceof StringLiteralArgValue)) {
      expect.unreachable("value should be StringLiteralArgValue");
    }
    expect(value.value).toBe("42");
  });
});
