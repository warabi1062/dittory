import type { ReactElement } from "react";
import { ParentComponentA } from "sample/ParentComponentA";

type Props = {
  number: string;
};
const App2 = (props: Props): ReactElement => {
  return (
    <div>
      <ParentComponentA number={props.number} />
      <ParentComponentA number={props.number} />
    </div>
  );
};

export const Test = () => {
  const number = "42";
  return (
    <div>
      <App2 number={number} />
      <App2 number={number} />
    </div>
  );
};
