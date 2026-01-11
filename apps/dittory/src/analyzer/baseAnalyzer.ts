import {
  type Identifier,
  Node,
  type ParameterDeclaration,
  type ReferencedSymbol,
} from "ts-morph";
import type { AnalyzedDeclarations } from "@/analyzedDeclarations";
import { ConstantParams } from "@/constantParams";
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
  AnalyzedDeclaration,
  AnalyzerOptions,
  ClassifiedDeclaration,
  Definition,
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
 * 宣言ごとの使用状況プロファイル（行番号とパラメータ使用状況）
 */
class DeclarationUsageProfile {
  readonly sourceLine: number;
  private readonly usageDataByParam: Map<string, UsageData>;
  /** 総呼び出し回数（ネストしたプロパティの存在チェックに使用） */
  private readonly totalCallCount: number;

  constructor(
    sourceLine: number,
    usageDataByParam: Map<string, UsageData>,
    totalCallCount: number,
  ) {
    this.sourceLine = sourceLine;
    this.usageDataByParam = usageDataByParam;
    this.totalCallCount = totalCallCount;
  }

  /**
   * 定数として認識されるパラメータを返す
   */
  *findConstantParams(
    minUsages: number,
  ): IterableIterator<[string, UsageData]> {
    for (const [paramName, usageData] of this.usageDataByParam) {
      if (usageData.isConstant(minUsages, this.totalCallCount)) {
        yield [paramName, usageData];
      }
    }
  }
}

/**
 * ファイル内の宣言（関数/コンポーネント）を管理するレジストリ
 */
class DeclarationRegistry {
  private readonly profilesByName = new Map<string, DeclarationUsageProfile>();

  /**
   * AnalyzedDeclaration から DeclarationUsageProfile を作成して追加
   */
  addFromDeclaration(analyzedDeclaration: AnalyzedDeclaration): void {
    const paramMap = new Map<string, UsageData>();
    for (const [paramName, usages] of Object.entries(
      analyzedDeclaration.usages,
    )) {
      paramMap.set(paramName, new UsageData(usages));
    }

    // 総呼び出し回数を計算（最大のUsage配列の長さを使用）
    // すべての呼び出しで存在するパラメータのUsage数が基準となる
    const totalCallCount = Math.max(
      ...Object.values(analyzedDeclaration.usages).map(
        (usages) => usages.length,
      ),
      0,
    );

    this.profilesByName.set(
      analyzedDeclaration.name,
      new DeclarationUsageProfile(
        analyzedDeclaration.sourceLine,
        paramMap,
        totalCallCount,
      ),
    );
  }

  /**
   * イテレーション用
   */
  *[Symbol.iterator](): Iterator<[string, DeclarationUsageProfile]> {
    yield* this.profilesByName;
  }
}

/**
 * 使用状況を階層的に管理するレジストリ
 *
 * 2階層の構造で使用状況を整理する:
 * 1. ソースファイルパス: どのファイルで定義された宣言か
 * 2. 宣言名: 関数名/コンポーネント名（+ 行番号とパラメータ使用状況）
 *
 * この構造により、定数検出時に効率的に走査できる。
 */
class UsageRegistry {
  private readonly registriesByFile = new Map<string, DeclarationRegistry>();

  /**
   * DeclarationRegistry を取得（存在しなければ作成）
   */
  private getOrCreateDeclarationRegistry(
    sourceFilePath: string,
  ): DeclarationRegistry {
    let declarationRegistry = this.registriesByFile.get(sourceFilePath);
    if (!declarationRegistry) {
      declarationRegistry = new DeclarationRegistry();
      this.registriesByFile.set(sourceFilePath, declarationRegistry);
    }
    return declarationRegistry;
  }

  /**
   * AnalyzedDeclarations から UsageRegistry を作成
   */
  static fromDeclarations(declarations: AnalyzedDeclarations): UsageRegistry {
    const usageRegistry = new UsageRegistry();
    for (const analyzedDeclaration of declarations) {
      usageRegistry
        .getOrCreateDeclarationRegistry(analyzedDeclaration.sourceFilePath)
        .addFromDeclaration(analyzedDeclaration);
    }
    return usageRegistry;
  }

  /**
   * すべての定数パラメータをフラットに取得
   */
  *findAllConstantParams(minUsages: number): IterableIterator<{
    sourceFile: string;
    declarationName: string;
    declarationLine: number;
    paramName: string;
    usageData: UsageData;
  }> {
    for (const [sourceFile, declarationRegistry] of this.registriesByFile) {
      for (const [declarationName, usageProfile] of declarationRegistry) {
        for (const [paramName, usageData] of usageProfile.findConstantParams(
          minUsages,
        )) {
          yield {
            sourceFile,
            declarationName,
            declarationLine: usageProfile.sourceLine,
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
  protected allowedValueTypes: ValueType[] | "all";
  protected callSiteMap!: CallSiteMap;

  constructor(options: AnalyzerOptions = {}) {
    this.shouldExcludeFile = options.shouldExcludeFile ?? isTestOrStorybookFile;
    this.minUsages = options.minUsages ?? 2;
    this.allowedValueTypes = options.allowedValueTypes ?? "all";
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
   * @param classifiedDeclarations - 事前分類済みの宣言配列
   */
  analyze(classifiedDeclarations: ClassifiedDeclaration[]): AnalysisResult {
    // 1. 分析対象を収集
    const declarations = this.collect(classifiedDeclarations);

    // 2. 使用状況をレジストリに登録
    const usageRegistry = UsageRegistry.fromDeclarations(declarations);

    // 3. 常に同じ値が渡されているパラメータを抽出
    const constantParams = this.extractConstantParams(usageRegistry);

    // 4. 結果を構築
    return { constantParams, declarations };
  }

  /**
   * 分析対象を収集する（サブクラスで実装）
   *
   * @param classifiedDeclarations - 事前分類済みの宣言配列
   */
  protected abstract collect(
    classifiedDeclarations: ClassifiedDeclaration[],
  ): AnalyzedDeclarations;

  /**
   * 常に同じ値が渡されているパラメータを抽出
   */
  private extractConstantParams(usageRegistry: UsageRegistry): ConstantParams {
    const constantParams = new ConstantParams();

    for (const entry of usageRegistry.findAllConstantParams(this.minUsages)) {
      const {
        sourceFile,
        declarationName,
        declarationLine,
        paramName,
        usageData,
      } = entry;
      const value = usageData.representativeValue;

      // 関数型の値は定数として報告しない
      // （onClickに同じハンドラを渡している等は、デフォルト値化の候補ではない）
      if (value instanceof FunctionArgValue) {
        continue;
      }

      // 値種別によるフィルタリング
      if (!matchesValueTypes(value, this.allowedValueTypes)) {
        continue;
      }

      constantParams.push({
        declarationName,
        declarationSourceFile: sourceFile,
        declarationLine,
        paramName,
        value,
        usages: usageData.usages,
      });
    }

    return constantParams;
  }
}
