import type { ReactElement } from "react";
import { ButtonVariant } from "./ButtonVariant";
import { TestComp } from "./TestComp";

export const Variant = (): ReactElement => {
  return (
    <div>
      <TestComp label="A" variant={ButtonVariant.Primary} />
      <TestComp label="B" variant={ButtonVariant.Primary} />
      <TestComp label="C" variant={ButtonVariant.Primary} />
    </div>
  );
};
