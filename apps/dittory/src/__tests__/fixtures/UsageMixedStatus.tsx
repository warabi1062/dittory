import type { ReactElement } from "react";
import { Status as StatusA } from "./StatusA";
import { Status as StatusB } from "./StatusB";
import { TestComp } from "./TestComp";

export const MixedStatus = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" status={StatusA.Active} />
      <TestComp label="B" status={StatusB.Active} />
    </div>
  );
};
