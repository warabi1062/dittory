import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const ConfigSame2 = (): ReactElement => {
  return <TestComp label="Page2" config={{ theme: "dark" }} />;
};
