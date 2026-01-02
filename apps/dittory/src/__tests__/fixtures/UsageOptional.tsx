import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const Optional = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" color="blue" disabled={true} />
      <TestComp label="B" color="red" disabled={true} />
      <TestComp label="C" color="green" />
    </div>
  );
};
