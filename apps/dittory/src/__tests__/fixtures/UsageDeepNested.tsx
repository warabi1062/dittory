import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const DeepNested = (): ReactElement => {
  return (
    <div>
      <TestComp
        label="A"
        style={{ colors: { primary: "blue", secondary: "gray" } }}
      />
      <TestComp
        label="B"
        style={{ colors: { primary: "blue", secondary: "gray" } }}
      />
    </div>
  );
};
