import { sendRequest } from "./testFunctionWithOptionalNested";

// configが未設定の呼び出し
sendRequest({
  url: "/api/users",
  method: "GET",
});
sendRequest({
  url: "/api/posts",
  method: "GET",
});

// configが設定されている呼び出し
sendRequest({
  url: "/api/comments",
  method: "GET",
  config: { timeout: 5000, retries: 2 },
});
sendRequest({
  url: "/api/tags",
  method: "GET",
  config: { timeout: 5000, retries: 3 },
});
