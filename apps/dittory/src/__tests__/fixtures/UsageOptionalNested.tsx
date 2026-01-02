import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const OptionalNested = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" config={{ theme: "dark", size: 10 }} />
      <TestComp label="B" config={{ theme: "dark" }} />
    </div>
  );
};
