/**
 * コールバック関数を受け取る関数
 */
export function executeWithCallback(
  data: string,
  callback: () => void,
): string {
  callback();
  return data;
}
