/**
 * Setから唯一の値を安全に取得する
 */
export function getSingleValueFromSet(values: Set<string>): string {
  if (values.size !== 1) {
    throw new Error(`Expected exactly 1 value, got ${values.size}`);
  }
  const [firstValue] = Array.from(values);
  return firstValue;
}
