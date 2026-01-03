import type { Node } from "ts-morph";

const DISABLE_NEXT_LINE = "dittory-disable-next-line";
const DISABLE_LINE = "dittory-disable-line";

/**
 * ノードに除外コメントがあるかを判定する
 *
 * 以下の2パターンをサポート：
 * - "dittory-disable-next-line": 次の行を除外（leading comments をチェック）
 * - "dittory-disable-line": 同じ行を除外（trailing comments をチェック）
 *
 * 祖先ノードを辿り、いずれかのノードのコメントに
 * 除外キーワードが含まれていれば除外対象とする。
 *
 * @param node - 判定対象のノード
 * @returns 除外コメントが存在すれば true
 */
export function hasDisableComment(node: Node): boolean {
  let current: Node | undefined = node;

  while (current) {
    const leadingComments = current.getLeadingCommentRanges();
    const trailingComments = current.getTrailingCommentRanges();

    for (const comment of leadingComments) {
      if (comment.getText().includes(DISABLE_NEXT_LINE)) {
        return true;
      }
    }

    for (const comment of trailingComments) {
      if (comment.getText().includes(DISABLE_LINE)) {
        return true;
      }
    }

    current = current.getParent();
  }

  return false;
}
