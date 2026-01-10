import type { ReactElement } from "react";
import { Button, ButtonVariant } from "./Button";

export const App = (): ReactElement => {
  return (
    <div>
      <Button
        variant={ButtonVariant.Primary}
        requiredEqualString="same"
        requiredEqualNumber={100}
        requiredEqualBoolean
        requiredEqualObject={{
          nestedEqualString: "nested-same",
          nestedEqualNumber: 42,
          nestedEqualBoolean: true,
          nestedDifferentString: "nested-a",
        }}
        requiredDifferentString="different-a"
        requiredDifferentNumber={1}
        optionalEqualString="optional-same"
        optionalDifferentString="optional-a"
      />
      <Button
        variant={ButtonVariant.Primary}
        requiredEqualString="same"
        requiredEqualNumber={100}
        requiredEqualBoolean={true}
        requiredEqualObject={{
          nestedEqualString: "nested-same",
          nestedEqualNumber: 42,
          nestedEqualBoolean: true,
          nestedDifferentString: "nested-b",
        }}
        requiredDifferentString="different-b"
        requiredDifferentNumber={2}
        optionalEqualString="optional-same"
        optionalDifferentString="optional-b"
      />
      <Button
        variant={ButtonVariant.Primary}
        requiredEqualString="same"
        requiredEqualNumber={100}
        requiredEqualBoolean={true}
        requiredEqualObject={{
          nestedEqualString: "nested-same",
          nestedEqualNumber: 42,
          nestedEqualBoolean: true,
        }}
        requiredDifferentString="different-c"
        requiredDifferentNumber={3}
        optionalEqualString="optional-same"
      />
    </div>
  );
};
