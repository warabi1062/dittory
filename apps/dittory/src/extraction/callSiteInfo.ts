import type { ArgValue } from "./argValue";

/**
 * 呼び出し箇所での引数情報
 */
export interface CallSiteArg {
  /** 引数のインデックス（0始まり）またはプロパティ名 */
  name: string;
  /** 引数の値 */
  value: ArgValue;
  /** 呼び出し元ファイルパス */
  filePath: string;
  /** 呼び出し元行番号 */
  line: number;
}

/**
 * 関数/コンポーネントへの呼び出し情報を管理するクラス
 * key: パラメータ名, value: 渡された値の配列
 */
export class CallSiteInfo {
  private map: Map<string, CallSiteArg[]>;

  constructor(initialMap?: Map<string, CallSiteArg[]>) {
    this.map = initialMap ?? new Map();
  }

  /**
   * 指定されたパラメータ名の引数情報を取得する
   */
  get(name: string): CallSiteArg[] | undefined {
    return this.map.get(name);
  }

  /**
   * 指定されたパラメータ名の引数情報を設定する
   */
  set(name: string, args: CallSiteArg[]): void {
    this.map.set(name, args);
  }

  /**
   * 引数情報を追加する
   * 既存の配列がある場合は追加、ない場合は新規作成
   */
  addArg(name: string, arg: CallSiteArg): void {
    const args = this.map.get(name) ?? [];
    args.push(arg);
    this.map.set(name, args);
  }
}
