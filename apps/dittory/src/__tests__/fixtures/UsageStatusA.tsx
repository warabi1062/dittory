import type { ReactElement } from "react";
import { Status as StatusA } from "./StatusA";
import { TestComp } from "./TestComp";

export const StatusA_Usage = (): ReactElement => {
  return <TestComp label="PageA" status={StatusA.Active} />;
};
