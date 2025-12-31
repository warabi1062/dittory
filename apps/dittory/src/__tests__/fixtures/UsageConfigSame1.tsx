import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const ConfigSame1 = (): ReactElement => {
  return <TestComp label="Page1" config={{ theme: "dark" }} />;
};
