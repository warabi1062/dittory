import { Logger } from "sample/Logger";

export class SampleClass {
  message: string;
  logger: Logger;

  constructor(message: string) {
    this.message = message;
    this.logger = new Logger();
  }

  printMessage(): void {
    this.logger.warn(this.message, "SampleClass");
    this.logger.warn(this.message, "SampleClass");
  }
}
