import assert from "node:assert/strict";
import test from "node:test";
import { boundedRequest } from "./boundedRequest";
test("a stalled request times out and aborts even when the transport ignores abort", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(boundedRequest(s => { signal=s; return new Promise(() => {}); },10), /request_timeout/);
  assert.equal(signal?.aborted,true);
});
test("a successful response or explicit rejection is not replaced by a timeout", async () => {
  assert.equal(await boundedRequest(async () => 7,100),7);
  await assert.rejects(boundedRequest(async () => { throw new Error("moves_after_battle_finished"); },100),/moves_after_battle_finished/);
});
