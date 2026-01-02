export class Logger {
  static log(message: string, level: string): void {
    console.log(`[${level}] ${message}`);
  }

  static error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}
