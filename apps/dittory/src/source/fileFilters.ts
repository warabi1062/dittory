/**
 * ファイルパスがテストファイルまたはStorybookファイルかどうかを判定する
 * - 拡張子が .test.* / .spec.* / .stories.* のファイル
 * - __tests__ / __stories__ フォルダ内のファイル
 */
export function isTestOrStorybookFile(filePath: string): boolean {
  // 拡張子ベースの判定
  if (/\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return true;
  }

  // フォルダ名ベースの判定
  if (/\b__tests__\b|\b__stories__\b/.test(filePath)) {
    return true;
  }

  return false;
}
