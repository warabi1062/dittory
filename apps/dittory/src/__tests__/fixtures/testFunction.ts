/**
 * テスト用の通常の関数
 */
export function formatValue(
  value: string,
  prefix: string,
  suffix?: string,
): string {
  return `${prefix}${value}${suffix ?? ""}`;
}

export const calculateSum = (
  a: number,
  b: number,
  multiplier?: number,
): number => {
  return (a + b) * (multiplier ?? 1);
};

export function processData(
  data: string,
  options: { uppercase: boolean; trim: boolean },
): string {
  let result = data;
  if (options.trim) {
    result = result.trim();
  }
  if (options.uppercase) {
    result = result.toUpperCase();
  }
  return result;
}
