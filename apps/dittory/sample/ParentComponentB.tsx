import { ChildComponent } from "sample/ChildComponentA";

type Props = {
  number: string;
};
export const ParentComponentB = (props: Props) => {
  return <ChildComponent number={props.number} />;
};
