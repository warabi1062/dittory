import type { ReactElement } from "react";
import type { ButtonVariant } from "./ButtonVariant";

export interface TestCompProps {
  label?: string;
  color?: string;
  disabled?: boolean;
  priority?: number;
  config?: {
    theme?: string;
    size?: number;
  };
  style?: {
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
  variant?: ButtonVariant;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のコンポーネントで、複数の異なるStatus enumを受け取る必要があるため
  status?: any;
  onClick?: () => void;
}

export const TestComp = ({
  label,
  color,
  disabled,
  priority,
  config,
  style,
  variant,
  status,
  onClick,
}: TestCompProps): ReactElement => {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ color }}
      className={variant}
      onClick={onClick}
    >
      {label} ({priority}) {config?.theme} {config?.size}{" "}
      {style?.colors?.primary}/{style?.colors?.secondary} {String(status)}
    </button>
  );
};
