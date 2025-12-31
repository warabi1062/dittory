import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

const config = { theme: "dark" };
export const ConfigDifferent1 = (): ReactElement => {
  return <TestComp label="Page1" config={config} />;
};
