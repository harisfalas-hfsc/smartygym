import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isRetryableGatewayStatus, retryDelayMs } from "./generate.server.ts";

Deno.test("only rate limits and server failures are retryable", () => {
  for (const status of [400, 401, 402, 403, 404]) assertEquals(isRetryableGatewayStatus(status), false);
  assert(isRetryableGatewayStatus(429));
  assert(isRetryableGatewayStatus(500));
  assert(isRetryableGatewayStatus(503));
});

Deno.test("retry delays are bounded and respect Retry-After", () => {
  assertEquals(retryDelayMs(0, 7_000), 7_000);
  assertEquals(retryDelayMs(0, 120_000), 60_000);
  for (const attempt of [0, 1, 2]) {
    const delay = retryDelayMs(attempt, null);
    assert(delay >= 1_000);
    assert(delay <= 8_499);
  }
});