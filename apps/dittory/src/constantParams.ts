import type { ArgValue } from "@/extraction/argValueClasses";
import type { ConstantParam, Usage } from "@/types";

/**
 * 宣言（関数/コンポーネント）ごとにグループ化された定数パラメータ情報
 */
export interface GroupedConstantParam {
  declarationName: string;
  declarationSourceFile: string;
  declarationLine: number;
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
export class ConstantParams {
  private readonly items: ConstantParam[];

  constructor(items: ConstantParam[] = []) {
    this.items = items;
  }

  /**
   * 複数の ConstantParams を結合して新しい ConstantParams を作成
   */
  static merge(...paramsArray: ConstantParams[]): ConstantParams {
    const merged: ConstantParam[] = [];
    for (const params of paramsArray) {
      merged.push(...params.items);
    }
    return new ConstantParams(merged);
  }

  /**
   * 定数パラメータが存在しないかどうか
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 定数パラメータの件数
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * 定数パラメータを追加
   */
  push(item: ConstantParam): void {
    this.items.push(item);
  }

  /**
   * 条件に一致する最初の定数パラメータを返す
   */
  find(
    predicate: (item: ConstantParam, index: number) => boolean,
  ): ConstantParam | undefined {
    return this.items.find(predicate);
  }

  /**
   * 宣言（関数/コンポーネント）ごとにグループ化
   */
  groupByDeclaration(): GroupedConstantParam[] {
    const groupMap = new Map<string, GroupedConstantParam>();

    for (const constantParam of this.items) {
      const key = `${constantParam.declarationSourceFile}:${constantParam.declarationName}`;

      let constantParamGroup = groupMap.get(key);
      if (!constantParamGroup) {
        constantParamGroup = {
          declarationName: constantParam.declarationName,
          declarationSourceFile: constantParam.declarationSourceFile,
          declarationLine: constantParam.declarationLine,
          params: [],
        };
        groupMap.set(key, constantParamGroup);
      }

      constantParamGroup.params.push({
        paramName: constantParam.paramName,
        value: constantParam.value,
        usageCount: constantParam.usages.length,
        usages: constantParam.usages,
      });
    }

    return Array.from(groupMap.values());
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<ConstantParam> {
    yield* this.items;
  }
}
