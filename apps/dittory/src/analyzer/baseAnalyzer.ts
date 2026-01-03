import { FUNCTION_VALUE_PREFIX } from "@/extraction/resolveExpressionValue";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type {
  AnalysisResult,
  AnalyzerOptions,
  ClassifiedDeclaration,
  Constant,
  Exported,
  FileFilter,
  Usage,
} from "@/types";
import { getSingleValueFromSet } from "@/utils/getSingleValueFromSet";

/**
 * 使用データのグループ
 * values.size === 1 の場合、そのパラメータは「定数」として検出される
 */
interface UsageData {
  values: Set<string>;
  usages: Usage[];
}

/**
 * 対象ごとの情報（行番号とパラメータ使用状況）
 */
interface TargetInfo {
  line: number;
  params: Map<string, UsageData>;
}

/**
 * 使用状況を階層的にグループ化したマップ
 *
 * 3階層の構造で使用状況を整理する:
 * 1. ソースファイルパス: どのファイルで定義された対象か
 * 2. 対象名: 関数名/コンポーネント名（+ 行番号とパラメータ使用状況）
 *
 * この構造により、定数検出時に効率的に走査できる。
 */
type GroupedMap = Map<string, Map<string, TargetInfo>>;

/**
 * 分析処理の基底クラス
 */
export abstract class BaseAnalyzer {
  protected shouldExcludeFile: FileFilter;
  protected minUsages: number;

  constructor(options: AnalyzerOptions = {}) {
    this.shouldExcludeFile = options.shouldExcludeFile ?? isTestOrStorybookFile;
    this.minUsages = options.minUsages ?? 2;
  }

  /**
   * メイン分析処理
   *
   * @param declarations - 事前分類済みの宣言配列
   */
  analyze(declarations: ClassifiedDeclaration[]): AnalysisResult {
    // 1. エクスポートされた対象を収集
    const exported = this.collect(declarations);

    // 2. 使用状況をグループ化
    const groupedMap = this.createGroupedMap(exported);

    // 3. 常に同じ値が渡されているパラメータを抽出
    const constants = this.extractConstants(groupedMap);

    // 4. 結果を構築
    return { constants, exported };
  }

  /**
   * エクスポートされた対象を収集する（サブクラスで実装）
   *
   * @param declarations - 事前分類済みの宣言配列
   */
  protected abstract collect(declarations: ClassifiedDeclaration[]): Exported[];

  /**
   * 使用状況をグループ化したマップを作成
   */
  private createGroupedMap(exported: Exported[]): GroupedMap {
    const groupedMap: GroupedMap = new Map();

    for (const item of exported) {
      let fileMap = groupedMap.get(item.sourceFilePath);
      if (!fileMap) {
        fileMap = new Map();
        groupedMap.set(item.sourceFilePath, fileMap);
      }

      const paramMap = new Map<string, UsageData>();
      for (const [paramName, usages] of Object.entries(item.usages)) {
        const values = new Set<string>();
        for (const usage of usages) {
          values.add(usage.value);
        }
        paramMap.set(paramName, { values, usages });
      }
      fileMap.set(item.name, { line: item.sourceLine, params: paramMap });
    }

    return groupedMap;
  }

  /**
   * 常に同じ値が渡されているパラメータを抽出
   */
  private extractConstants(groupedMap: GroupedMap): Constant[] {
    const result: Constant[] = [];

    for (const [sourceFile, targetMap] of groupedMap) {
      for (const [targetName, targetInfo] of targetMap) {
        for (const [paramName, usageData] of targetInfo.params) {
          const isConstant =
            usageData.usages.length >= this.minUsages &&
            usageData.values.size === 1;

          if (!isConstant) {
            continue;
          }

          const value = getSingleValueFromSet(usageData.values);

          // 関数型の値は定数として報告しない
          // （onClickに同じハンドラを渡している等は、デフォルト値化の候補ではない）
          if (value.startsWith(FUNCTION_VALUE_PREFIX)) {
            continue;
          }

          result.push({
            targetName,
            targetSourceFile: sourceFile,
            targetLine: targetInfo.line,
            paramName,
            value,
            usages: usageData.usages,
          });
        }
      }
    }

    return result;
  }
}
