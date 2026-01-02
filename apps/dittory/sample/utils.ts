export function formatPrice(amount: number, currency: string): string {
  return `${currency}${amount.toFixed(2)}`;
}

export function log(message: string, level: string): void {
  console.log(`[${level}] ${message}`);
}

type RequestOptions = {
  url: string;
  method: string;
  config: {
    timeout: number;
    retries: number;
  };
};

export function sendRequest(options: RequestOptions): void {
  console.log(
    `Sending ${options.method} request to ${options.url} with timeout ${options.config.timeout}`,
  );
}
