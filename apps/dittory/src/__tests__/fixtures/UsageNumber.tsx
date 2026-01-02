import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const NumberProps = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" color="blue" priority={10} />
      <TestComp label="B" color="red" priority={10} />
    </div>
  );
};
