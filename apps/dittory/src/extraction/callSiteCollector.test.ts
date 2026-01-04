import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { collectCallSites, createTargetId } from "./callSiteCollector";

describe("collectCallSites", () => {
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
    const callSiteMap = collectCallSites(sourceFiles);

    // Debug
    console.log("callSiteMap keys:", [...callSiteMap.keys()]);
    for (const [key, value] of callSiteMap) {
      console.log(`  ${key}:`, [...value.keys()]);
    }

    // Assert
    const childTargetId = createTargetId("/src/Child.tsx", "Child");
    console.log("Looking for targetId:", childTargetId);
    const childInfo = callSiteMap.get(childTargetId);

    expect(childInfo).toBeDefined();
    expect(childInfo?.get("value")).toBeDefined();
    expect(childInfo?.get("value")?.length).toBe(1);
    expect(childInfo?.get("value")?.[0].value).toBe('"hello"');
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
    const callSiteMap = collectCallSites(sourceFiles);

    // Assert
    const childTargetId = createTargetId("/src/Child.tsx", "ChildComponent");
    const childInfo = callSiteMap.get(childTargetId);

    expect(childInfo).toBeDefined();
    expect(childInfo?.get("number")).toBeDefined();
    expect(childInfo?.get("number")?.length).toBe(1);

    const value = childInfo?.get("number")?.[0].value;
    console.log("Parameter reference value:", value);
    expect(value).toContain("[param]");
    expect(value).toContain("ParentComponent");
    expect(value).toContain("props.number");
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
    const callSiteMap = collectCallSites(sourceFiles);

    // Assert
    const parentTargetId = createTargetId("/src/Parent.tsx", "ParentComponent");
    const parentInfo = callSiteMap.get(parentTargetId);

    expect(parentInfo).toBeDefined();
    expect(parentInfo?.get("number")).toBeDefined();
    expect(parentInfo?.get("number")?.length).toBe(1);
    expect(parentInfo?.get("number")?.[0].value).toBe('"42"');
  });
});
