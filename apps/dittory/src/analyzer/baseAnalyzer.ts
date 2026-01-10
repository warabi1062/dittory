import {
  type Identifier,
  Node,
  type ParameterDeclaration,
  type ReferencedSymbol,
} from "ts-morph";
import type { CallSiteMap } from "@/extraction/callSiteMap";
import {
  ExpressionResolver,
  FUNCTION_VALUE_PREFIX,
} from "@/extraction/expressionResolver";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type {
  AnalysisResult,
  AnalyzerOptions,
  ClassifiedDeclaration,
  Constant,
  Definition,
  Exported,
  FileFilter,
  Usage,
} from "@/types";
import { getSingleValueFromSet } from "@/utils/getSingleValueFromSet";
import {
  detectValueType,
  matchesValueTypes,
  type ValueType,
} from "@/utils/valueTypeDetector";

/**
 * ts-morph の参照情報を表す型
 */
type ReferenceEntry = ReturnType<ReferencedSymbol["getReferences"]>[number];

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
  /** 総呼び出し回数（ネストしたプロパティの存在チェックに使用） */
  totalCallCount: number;
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
  protected valueTypes: ValueType[] | "all";
  protected callSiteMap!: CallSiteMap;

  constructor(options: AnalyzerOptions = {}) {
    this.shouldExcludeFile = options.shouldExcludeFile ?? isTestOrStorybookFile;
    this.minUsages = options.minUsages ?? 2;
    this.valueTypes = options.valueTypes ?? "all";
  }

  /**
   * 呼び出し情報を設定する
   * パラメータ経由で渡された値を解決するために使用
   *
   * @param callSiteMap - 呼び出し情報マップ
   */
  setCallSiteMap(callSiteMap: CallSiteMap): void {
    this.callSiteMap = callSiteMap;
  }

  /**
   * 式のリゾルバを取得する
   */
  protected getExpressionResolver(): ExpressionResolver {
    return new ExpressionResolver(this.callSiteMap);
  }

  /**
   * 識別子から全参照を検索し、除外対象ファイルからの参照をフィルタリングする
   *
   * @param nameNode - 検索対象の識別子ノード
   * @returns フィルタリングされた参照エントリの配列
   */
  protected findFilteredReferences(nameNode: Identifier): ReferenceEntry[] {
    return nameNode
      .findReferences()
      .flatMap((referencedSymbol) => referencedSymbol.getReferences())
      .filter(
        (ref) => !this.shouldExcludeFile(ref.getSourceFile().getFilePath()),
      );
  }

  /**
   * 使用状況をグループに追加する
   *
   * @param groupedUsages - 使用状況のグループ（パラメータ名 → 使用状況配列）
   * @param usages - 追加する使用状況の配列
   */
  protected addUsagesToGroup(
    groupedUsages: Record<string, Usage[]>,
    usages: Usage[],
  ): void {
    for (const usage of usages) {
      if (!groupedUsages[usage.name]) {
        groupedUsages[usage.name] = [];
      }
      groupedUsages[usage.name].push(usage);
    }
  }

  /**
   * ノードからパラメータ定義を取得する
   *
   * FunctionDeclaration, MethodDeclaration, VariableDeclaration（ArrowFunction/FunctionExpression）
   * からパラメータを抽出し、Definition配列として返す。
   *
   * @param node - パラメータを抽出する対象のノード
   * @returns パラメータ定義の配列
   */
  protected getParameterDefinitions(node: Node): Definition[] {
    const params = this.extractParameterDeclarations(node);
    return params.map((param, index) => ({
      name: param.getName(),
      index,
      required: !param.hasQuestionToken() && !param.hasInitializer(),
    }));
  }

  /**
   * ノードからParameterDeclarationの配列を抽出する
   *
   * 以下のノードタイプに対応:
   * - FunctionDeclaration: 直接パラメータを取得
   * - MethodDeclaration: 直接パラメータを取得
   * - VariableDeclaration: 初期化子がArrowFunctionまたはFunctionExpressionの場合にパラメータを取得
   *
   * @param node - パラメータを抽出する対象のノード
   * @returns ParameterDeclarationの配列
   */
  protected extractParameterDeclarations(node: Node): ParameterDeclaration[] {
    if (Node.isFunctionDeclaration(node)) {
      return node.getParameters();
    }

    if (Node.isMethodDeclaration(node)) {
      return node.getParameters();
    }

    if (Node.isVariableDeclaration(node)) {
      const initializer = node.getInitializer();
      if (initializer) {
        if (
          Node.isArrowFunction(initializer) ||
          Node.isFunctionExpression(initializer)
        ) {
          return initializer.getParameters();
        }
      }
    }

    return [];
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

      // 総呼び出し回数を計算（最大のUsage配列の長さを使用）
      // すべての呼び出しで存在するパラメータのUsage数が基準となる
      const totalCallCount = Math.max(
        ...Object.values(item.usages).map((usages) => usages.length),
        0,
      );

      fileMap.set(item.name, {
        line: item.sourceLine,
        params: paramMap,
        totalCallCount,
      });
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
          // 定数として認識する条件:
          // 1. 使用回数が最小使用回数以上
          // 2. すべての使用箇所で同じ値
          // 3. Usage数が総呼び出し回数と一致（すべての呼び出しで値が存在）
          //    これにより、オプショナルなプロパティが一部の呼び出しでのみ
          //    指定されている場合を定数として誤検出しない
          const isConstant =
            usageData.usages.length >= this.minUsages &&
            usageData.values.size === 1 &&
            usageData.usages.length === targetInfo.totalCallCount;

          if (!isConstant) {
            continue;
          }

          const value = getSingleValueFromSet(usageData.values);

          // 関数型の値は定数として報告しない
          // （onClickに同じハンドラを渡している等は、デフォルト値化の候補ではない）
          if (value.startsWith(FUNCTION_VALUE_PREFIX)) {
            continue;
          }

          // 値種別によるフィルタリング
          if (!matchesValueTypes(value, this.valueTypes)) {
            continue;
          }

          result.push({
            targetName,
            targetSourceFile: sourceFile,
            targetLine: targetInfo.line,
            paramName,
            value,
            valueType: detectValueType(value),
            usages: usageData.usages,
          });
        }
      }
    }

    return result;
  }
}
