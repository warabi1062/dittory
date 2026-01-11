import {
  type Identifier,
  Node,
  type ParameterDeclaration,
  type ReferencedSymbol,
} from "ts-morph";
import { Constants } from "@/constants";
import type { Exporteds } from "@/exporteds";
import {
  type ArgValue,
  FunctionArgValue,
  UndefinedArgValue,
} from "@/extraction/argValueClasses";
import type { CallSiteMap } from "@/extraction/callSiteMap";
import { ExpressionResolver } from "@/extraction/expressionResolver";
import {
  matchesValueTypes,
  type ValueType,
} from "@/extraction/valueTypeDetector";
import { isTestOrStorybookFile } from "@/source/fileFilters";
import type {
  AnalysisResult,
  AnalyzerOptions,
  ClassifiedDeclaration,
  Definition,
  Exported,
  FileFilter,
  Usage,
} from "@/types";

/**
 * ts-morph の参照情報を表す型
 */
type ReferenceEntry = ReturnType<ReferencedSymbol["getReferences"]>[number];

/**
 * 使用データのグループ
 *
 * 各パラメータに渡された値を集約し、定数判定を行う
 */
class UsageData {
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

/**
 * 対象ごとの情報（行番号とパラメータ使用状況）
 */
class TargetInfo {
  readonly line: number;
  private readonly params: Map<string, UsageData>;
  /** 総呼び出し回数（ネストしたプロパティの存在チェックに使用） */
  private readonly totalCallCount: number;

  constructor(
    line: number,
    params: Map<string, UsageData>,
    totalCallCount: number,
  ) {
    this.line = line;
    this.params = params;
    this.totalCallCount = totalCallCount;
  }

  /**
   * 定数として認識されるパラメータを返す
   */
  *findConstantParams(
    minUsages: number,
  ): IterableIterator<[string, UsageData]> {
    for (const [paramName, usageData] of this.params) {
      if (usageData.isConstant(minUsages, this.totalCallCount)) {
        yield [paramName, usageData];
      }
    }
  }
}

/**
 * ファイル内の対象（関数/コンポーネント）を管理するマップ
 */
class TargetMap {
  private readonly map = new Map<string, TargetInfo>();

  /**
   * Exported から TargetInfo を作成して追加
   */
  addFromExported(item: Exported): void {
    const paramMap = new Map<string, UsageData>();
    for (const [paramName, usages] of Object.entries(item.usages)) {
      paramMap.set(paramName, new UsageData(usages));
    }

    // 総呼び出し回数を計算（最大のUsage配列の長さを使用）
    // すべての呼び出しで存在するパラメータのUsage数が基準となる
    const totalCallCount = Math.max(
      ...Object.values(item.usages).map((usages) => usages.length),
      0,
    );

    this.map.set(
      item.name,
      new TargetInfo(item.sourceLine, paramMap, totalCallCount),
    );
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<[string, TargetInfo]> {
    yield* this.map;
  }
}

/**
 * 使用状況を階層的にグループ化したマップ
 *
 * 2階層の構造で使用状況を整理する:
 * 1. ソースファイルパス: どのファイルで定義された対象か
 * 2. 対象名: 関数名/コンポーネント名（+ 行番号とパラメータ使用状況）
 *
 * この構造により、定数検出時に効率的に走査できる。
 */
class GroupedMap {
  private readonly map = new Map<string, TargetMap>();

  /**
   * TargetMap を取得（存在しなければ作成）
   */
  private getOrCreateTargetMap(sourceFilePath: string): TargetMap {
    let targetMap = this.map.get(sourceFilePath);
    if (!targetMap) {
      targetMap = new TargetMap();
      this.map.set(sourceFilePath, targetMap);
    }
    return targetMap;
  }

  /**
   * Exporteds から GroupedMap を作成
   */
  static fromExporteds(exporteds: Exporteds): GroupedMap {
    const groupedMap = new GroupedMap();
    for (const item of exporteds) {
      groupedMap
        .getOrCreateTargetMap(item.sourceFilePath)
        .addFromExported(item);
    }
    return groupedMap;
  }

  /**
   * すべての定数パラメータをフラットに取得
   */
  *findAllConstantParams(minUsages: number): IterableIterator<{
    sourceFile: string;
    targetName: string;
    targetLine: number;
    paramName: string;
    usageData: UsageData;
  }> {
    for (const [sourceFile, targetMap] of this.map) {
      for (const [targetName, targetInfo] of targetMap) {
        for (const [paramName, usageData] of targetInfo.findConstantParams(
          minUsages,
        )) {
          yield {
            sourceFile,
            targetName,
            targetLine: targetInfo.line,
            paramName,
            usageData,
          };
        }
      }
    }
  }
}

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
    const groupedMap = GroupedMap.fromExporteds(exported);

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
  protected abstract collect(declarations: ClassifiedDeclaration[]): Exporteds;

  /**
   * 常に同じ値が渡されているパラメータを抽出
   */
  private extractConstants(groupedMap: GroupedMap): Constants {
    const result = new Constants();

    for (const entry of groupedMap.findAllConstantParams(this.minUsages)) {
      const { sourceFile, targetName, targetLine, paramName, usageData } =
        entry;
      const value = usageData.representativeValue;

      // 関数型の値は定数として報告しない
      // （onClickに同じハンドラを渡している等は、デフォルト値化の候補ではない）
      if (value instanceof FunctionArgValue) {
        continue;
      }

      // 値種別によるフィルタリング
      if (!matchesValueTypes(value, this.valueTypes)) {
        continue;
      }

      result.push({
        targetName,
        targetSourceFile: sourceFile,
        targetLine,
        paramName,
        value,
        usages: usageData.usages,
      });
    }

    return result;
  }
}
