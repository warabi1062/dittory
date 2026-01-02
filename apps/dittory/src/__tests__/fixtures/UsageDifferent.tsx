import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const Different = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" color="blue" />
      <TestComp label="B" color="red" />
    </div>
  );
};
