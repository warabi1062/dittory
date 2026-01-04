import { ChildComponent } from "sample/ChildComponentA";

type Props = {
  number: string;
};
export const ParentComponentA = (props: Props) => {
  return <ChildComponent number={props.number} />;
};
