import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const NestedConstant = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" config={{ theme: "dark", size: 10 }} />
      <TestComp label="B" config={{ theme: "dark", size: 10 }} />
    </div>
  );
};
