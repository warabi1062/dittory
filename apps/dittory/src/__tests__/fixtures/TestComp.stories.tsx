import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

export const Primary = (): ReactElement => {
  return <TestComp label="Story" color="red" />;
};
