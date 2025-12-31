import type { ReactElement } from "react";
import { TestComp } from "./TestComp";

const handleClick = (): void => {
  console.log("clicked");
};

export const App1 = (): ReactElement => {
  return <TestComp label="Button1" onClick={handleClick} />;
};

export const App2 = (): ReactElement => {
  return <TestComp label="Button2" onClick={handleClick} />;
};

export const App3 = (): ReactElement => {
  return <TestComp label="Button3" onClick={handleClick} />;
};
