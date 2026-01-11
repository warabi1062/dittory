import type { Usage } from "@/types";

/**
 * パラメータ名ごとにUsageをグループ化して管理するクラス
 */
export class UsageGroup {
  private usagesByName: Map<string, Usage[]>;

  constructor() {
    this.usagesByName = new Map();
  }

  /**
   * Usageを追加する
   */
  add(usage: Usage): void {
    const usages = this.usagesByName.get(usage.name) ?? [];
    usages.push(usage);
    this.usagesByName.set(usage.name, usages);
  }

  /**
   * 複数のUsageを追加する
   */
  addAll(usages: readonly Usage[]): void {
    for (const usage of usages) {
      this.add(usage);
    }
  }

  /**
   * 指定されたパラメータ名のUsage配列を取得する
   */
  get(name: string): Usage[] | undefined {
    return this.usagesByName.get(name);
  }

  /**
   * パラメータ名とUsage配列のペアを返すイテレータ
   */
  entries(): IterableIterator<[string, Usage[]]> {
    return this.usagesByName.entries();
  }

  /**
   * Usage配列のイテレータ
   */
  values(): IterableIterator<Usage[]> {
    return this.usagesByName.values();
  }

  /**
   * グループ数を返す
   */
  get size(): number {
    return this.usagesByName.size;
  }
}
