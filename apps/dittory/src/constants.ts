import type { ArgValue } from "@/extraction/argValueClasses";
import type { Constant, Usage } from "@/types";

/**
 * ターゲット（関数/コンポーネント）ごとにグループ化された定数情報
 */
export interface GroupedConstant {
  targetName: string;
  targetSourceFile: string;
  targetLine: number;
  params: Array<{
    paramName: string;
    value: ArgValue;
    usageCount: number;
    usages: Usage[];
  }>;
}

/**
 * 定数パラメータのコレクション
 */
export class Constants {
  private readonly items: Constant[];

  constructor(items: Constant[] = []) {
    this.items = items;
  }

  /**
   * 複数の Constants を結合して新しい Constants を作成
   */
  static merge(...constantsArray: Constants[]): Constants {
    const merged: Constant[] = [];
    for (const constants of constantsArray) {
      merged.push(...constants.items);
    }
    return new Constants(merged);
  }

  /**
   * 定数が存在しないかどうか
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 定数の件数
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * 定数を追加
   */
  push(item: Constant): void {
    this.items.push(item);
  }

  /**
   * 条件に一致する最初の定数を返す
   */
  find(
    predicate: (item: Constant, index: number) => boolean,
  ): Constant | undefined {
    return this.items.find(predicate);
  }

  /**
   * ターゲット（関数/コンポーネント）ごとにグループ化
   */
  groupByTarget(): GroupedConstant[] {
    const groupMap = new Map<string, GroupedConstant>();

    for (const constant of this.items) {
      const key = `${constant.targetSourceFile}:${constant.targetName}`;

      let group = groupMap.get(key);
      if (!group) {
        group = {
          targetName: constant.targetName,
          targetSourceFile: constant.targetSourceFile,
          targetLine: constant.targetLine,
          params: [],
        };
        groupMap.set(key, group);
      }

      group.params.push({
        paramName: constant.paramName,
        value: constant.value,
        usageCount: constant.usages.length,
        usages: constant.usages,
      });
    }

    return Array.from(groupMap.values());
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<Constant> {
    yield* this.items;
  }
}
