import type { ReactElement } from "react";

export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
}

interface ButtonProps {
  // enum
  variant: ButtonVariant;
  // 必須・常に同じ値
  requiredEqualString: string;
  requiredEqualNumber: number;
  requiredEqualBoolean: boolean;
  requiredEqualObject: {
    nestedEqualString: string;
    nestedEqualNumber: number;
    nestedEqualBoolean: boolean;
    nestedDifferentString?: string;
  };

  // 必須・異なる値
  requiredDifferentString: string;
  requiredDifferentNumber: number;

  // オプショナル・常に同じ値
  optionalEqualString?: string;

  // オプショナル・異なる値（渡す/渡さないの違いを含む）
  optionalDifferentString?: string;
}

export const Button = ({
  variant,
  requiredEqualString,
  requiredEqualNumber,
  requiredEqualBoolean,
  requiredEqualObject,
  requiredDifferentString,
  requiredDifferentNumber,
  optionalEqualString,
  optionalDifferentString,
}: ButtonProps): ReactElement => {
  return (
    <button type="button">
      {variant} - {requiredEqualString} - {requiredEqualNumber} -{" "}
      {String(requiredEqualBoolean)} -{requiredEqualObject.nestedEqualString} -{" "}
      {requiredDifferentString} -{requiredDifferentNumber} -{" "}
      {optionalEqualString} - {optionalDifferentString}
    </button>
  );
};
