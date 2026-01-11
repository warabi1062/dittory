import type { ArgValue } from "./argValueClasses";

/**
 * 使用箇所の共通interface
 * 関数呼び出しやJSX要素で、どのパラメータにどの値が渡されたかを記録する
 */
export interface Usage {
  /** ネストしたプロパティの場合は "param.nested.key" 形式 */
  name: string;
  /** リテラル値、enum参照、変数参照などを解決した結果 */
  value: ArgValue;
  usageFilePath: string;
  usageLine: number;
}

/**
 * パラメータ/props定義の共通interface
 */
export interface Definition {
  name: string;
  /** 引数リストにおける位置（0始まり） */
  index: number;
  /** ?がなく、デフォルト値もない場合はtrue */
  required: boolean;
}

/**
 * パラメータ名ごとにUsageをグループ化して管理するクラス
 */
export class UsagesByParam extends Map<string, Usage[]> {
  /**
   * Usageを追加する
   */
  add(usage: Usage): void {
    const usages = this.get(usage.name) ?? [];
    usages.push(usage);
    this.set(usage.name, usages);
  }

  /**
   * 複数のUsageを追加する
   */
  addAll(usages: readonly Usage[]): void {
    for (const usage of usages) {
      this.add(usage);
    }
  }
}
