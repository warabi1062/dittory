type RequestOptions = {
  url: string;
  method: string;
  config?: {
    timeout?: number;
    retries: number;
  };
};

export function sendRequest(options: RequestOptions): void {
  console.log(
    `Sending ${options.method} request to ${options.url} with timeout ${options.config?.timeout}`,
  );
}
