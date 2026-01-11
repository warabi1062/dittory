import type {
  FunctionDeclaration,
  MethodDeclaration,
  VariableDeclaration,
} from "ts-morph";
import type { Definition, UsagesByParam } from "@/domain/usagesByParam";

/**
 * 分析対象（エクスポートされた関数/コンポーネント）
 */
export interface AnalyzedDeclaration {
  /** クラスメソッドの場合は "ClassName.methodName" 形式 */
  name: string;
  sourceFilePath: string;
  sourceLine: number;
  definitions: Definition[];
  declaration: FunctionDeclaration | VariableDeclaration | MethodDeclaration;
  usages: UsagesByParam;
}

/**
 * 分析対象のコレクション
 */
export class AnalyzedDeclarations {
  private readonly items: AnalyzedDeclaration[];

  constructor(items: AnalyzedDeclaration[] = []) {
    this.items = items;
  }

  /**
   * 複数の AnalyzedDeclarations を結合して新しい AnalyzedDeclarations を作成
   */
  static merge(
    ...declarationsArray: AnalyzedDeclarations[]
  ): AnalyzedDeclarations {
    const merged: AnalyzedDeclaration[] = [];
    for (const declarations of declarationsArray) {
      merged.push(...declarations.items);
    }
    return new AnalyzedDeclarations(merged);
  }

  /**
   * 分析対象が存在しないかどうか
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 分析対象の件数
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * 分析対象を追加
   */
  push(item: AnalyzedDeclaration): void {
    this.items.push(item);
  }

  /**
   * 各要素に対して関数を適用し、結果の配列を返す
   */
  map<T>(callback: (item: AnalyzedDeclaration, index: number) => T): T[] {
    return this.items.map(callback);
  }

  /**
   * 条件に一致する最初の要素を返す
   */
  find(
    predicate: (item: AnalyzedDeclaration, index: number) => boolean,
  ): AnalyzedDeclaration | undefined {
    return this.items.find(predicate);
  }

  /**
   * インデックスで要素を取得
   */
  get(index: number): AnalyzedDeclaration | undefined {
    return this.items[index];
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<AnalyzedDeclaration> {
    yield* this.items;
  }
}
