import { Logger } from "./Logger";
import { formatPrice, log, sendRequest } from "./utils";

// currencyが常に"¥"で呼ばれている
export const price1: string = formatPrice(100, "¥");
export const price2: string = formatPrice(200, "¥");
export const price3: string = formatPrice(300, "¥");

// levelが常に"INFO"で呼ばれている
log("Starting app", "INFO");
log("Loading config", "INFO");
log("Ready", "INFO");

// static methodのlevelが常に"DEBUG"で呼ばれている
Logger.log("Debug message 1", "DEBUG");
Logger.log("Debug message 2", "DEBUG");
Logger.log("Debug message 3", "DEBUG");

// インスタンスメソッドのtagが常に"APP"で呼ばれている
const logger = new Logger();
logger.info("Instance message 1", "APP");
logger.info("Instance message 2", "APP");
logger.info("Instance message 3", "APP");

// オブジェクト引数の動作確認
// options.method と options.config.timeout は常に同じ値
// options.url と options.config.retries は異なる値
sendRequest({
  url: "/api/users",
  method: "GET",
  config: { timeout: 5000, retries: 1 },
});
sendRequest({
  url: "/api/users",
  method: "GET",
  config: { timeout: 5000, retries: 1 },
});
sendRequest({
  url: "/api/posts",
  method: "GET",
  config: { timeout: 5000, retries: 2 },
});
sendRequest({
  url: "/api/comments",
  method: "GET",
  config: { timeout: 5000, retries: 3 },
});
