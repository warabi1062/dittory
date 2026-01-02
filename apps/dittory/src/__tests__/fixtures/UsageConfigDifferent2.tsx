import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

const config = { theme: "light" };
export const ConfigDifferent2 = (): ReactElement => {
  return <TestComp label="Page2" config={config} />;
};
