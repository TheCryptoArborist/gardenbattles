import assert from "node:assert/strict";
import test from "node:test";
import { getPvpMatchOption, SUI_CONFIG } from "./sui-config";

test("production defaults route app Sui client through the Garden Battles RPC proxy", () => {
  assert.equal(
    SUI_CONFIG.RPC_URL,
    "https://gardenbattles-production.up.railway.app/api/sui-rpc",
  );
  assert.equal(SUI_CONFIG.READ_RPC_URL, SUI_CONFIG.RPC_URL);
});

test("production defaults use live v3 queue and FifthMoveConfig IDs", () => {
  assert.equal(
    SUI_CONFIG.MATCHMAKING_QUEUE_V3_50_ID,
    "0xb380a69e611ad7636f2b7993fab6656c272c0802fd7a6ec35448a58956a0c38f",
  );
  assert.equal(
    SUI_CONFIG.MATCHMAKING_QUEUE_V3_75_ID,
    "0x03e77c44e4ef2a6203a0d84378a4a8faf3acfb82ddfef84cd5e0bb243ff5abe1",
  );
  assert.equal(
    SUI_CONFIG.FIFTH_MOVE_CONFIG_ID,
    "0x083a9303bd13b789e87f3e746b817a8723290f25414f3686ac8868f90a5020b3",
  );

  const quick = getPvpMatchOption(50);
  const standard = getPvpMatchOption(75);

  assert.equal(quick.queueType, "v3");
  assert.equal(quick.queueId, SUI_CONFIG.MATCHMAKING_QUEUE_V3_50_ID);
  assert.equal(standard.queueType, "v3");
  assert.equal(standard.queueId, SUI_CONFIG.MATCHMAKING_QUEUE_V3_75_ID);
});
