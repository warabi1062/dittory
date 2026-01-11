import type { Usage } from "@/domain/usagesByParam";
import { type ArgValue, UndefinedArgValue } from "./argValueClasses";

/**
 * 定数候補
 *
 * あるパラメータに渡された値を集約し、定数として扱えるかを判定する
 */
export class ConstantCandidate {
  /** 値の比較キー（toKey()の結果）のセット */
  private readonly valueKeys: Set<string>;
  /** 代表的な値（定数検出時に使用） */
  readonly representativeValue: ArgValue;
  readonly usages: Usage[];

  constructor(usages: Usage[]) {
    this.usages = usages;
    this.valueKeys = new Set<string>();
    let representativeValue: ArgValue = new UndefinedArgValue();
    for (const usage of usages) {
      this.valueKeys.add(usage.value.toKey());
      representativeValue = usage.value;
    }
    this.representativeValue = representativeValue;
  }

  /**
   * 定数として認識できるかを判定
   *
   * 条件:
   * 1. 使用回数が最小使用回数以上
   * 2. すべての使用箇所で同じ値（valueKeys.size === 1）
   * 3. Usage数が総呼び出し回数と一致（すべての呼び出しで値が存在）
   *    これにより、オプショナルなプロパティが一部の呼び出しでのみ
   *    指定されている場合を定数として誤検出しない
   */
  isConstant(minUsages: number, totalCallCount: number): boolean {
    return (
      this.usages.length >= minUsages &&
      this.valueKeys.size === 1 &&
      this.usages.length === totalCallCount
    );
  }
}
