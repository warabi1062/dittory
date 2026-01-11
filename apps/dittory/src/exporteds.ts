import type { Exported } from "@/types";

/**
 * エクスポートされた対象のコレクション
 */
export class Exporteds {
  private readonly items: Exported[];

  constructor(items: Exported[] = []) {
    this.items = items;
  }

  /**
   * 複数の Exporteds を結合して新しい Exporteds を作成
   */
  static merge(...exportedsArray: Exporteds[]): Exporteds {
    const merged: Exported[] = [];
    for (const exporteds of exportedsArray) {
      merged.push(...exporteds.items);
    }
    return new Exporteds(merged);
  }

  /**
   * エクスポートが存在しないかどうか
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * エクスポートの件数
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * エクスポートを追加
   */
  push(item: Exported): void {
    this.items.push(item);
  }

  /**
   * 各要素に対して関数を適用し、結果の配列を返す
   */
  map<T>(callback: (item: Exported, index: number) => T): T[] {
    return this.items.map(callback);
  }

  /**
   * 条件に一致する最初の要素を返す
   */
  find(
    predicate: (item: Exported, index: number) => boolean,
  ): Exported | undefined {
    return this.items.find(predicate);
  }

  /**
   * インデックスで要素を取得
   */
  get(index: number): Exported | undefined {
    return this.items[index];
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<Exported> {
    yield* this.items;
  }
}
