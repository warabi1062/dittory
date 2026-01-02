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
