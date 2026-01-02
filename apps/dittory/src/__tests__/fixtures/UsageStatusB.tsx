import type { ReactElement } from "react";
import { Status as StatusB } from "./StatusB";
import { TestComp } from "./TestComp";

export const StatusB_Usage = (): ReactElement => {
  return <TestComp label="PageB" status={StatusB.Active} />;
};
