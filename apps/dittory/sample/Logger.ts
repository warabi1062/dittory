export class Logger {
  static log(message: string, level: string): void {
    console.log(`[${level}] ${message}`);
  }

  static error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  // インスタンスメソッド
  info(message: string, tag: string): void {
    console.log(`[INFO:${tag}] ${message}`);
  }
}
