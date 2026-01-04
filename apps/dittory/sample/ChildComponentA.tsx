import { Button } from "sample/Button";

type Props = {
  number: string;
};
export const ChildComponent = (props: Props) => {
  return <div>{props.number}</div>;
};
