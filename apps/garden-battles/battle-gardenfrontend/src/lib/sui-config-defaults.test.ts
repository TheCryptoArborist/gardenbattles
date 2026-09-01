import assert from "node:assert/strict";
import test from "node:test";
import {
  getPvpBattleV3UpdateEvent,
  getPvpMatchOption,
  SUI_CONFIG,
} from "./sui-config";

test("production defaults use independent JSON-RPC compatibility providers", () => {
  assert.equal(
    SUI_CONFIG.RPC_URL,
    "https://sui-rpc.publicnode.com",
  );
  assert.equal(
    SUI_CONFIG.RPC_FALLBACK_URL,
    "https://sui-mainnet-endpoint.blockvision.org",
  );
  assert.notEqual(SUI_CONFIG.RPC_URL, SUI_CONFIG.RPC_FALLBACK_URL);
});

test("production defaults use live v3 queue and FifthMoveConfig IDs", () => {
  assert.equal(
    SUI_CONFIG.PACKAGE_ID,
    "0x053f4cf0bd41ba3340a0580f4ae1aaca18656ba0032eb3e920de554309d97755",
  );
  assert.equal(
    getPvpBattleV3UpdateEvent(),
    "0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf::battle::PvpBattleV3Update",
  );
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
  assert.equal(
    SUI_CONFIG.TREE_CONFIG_ID,
    "0x828da1764a6c1d4d9c31cc2dc54eac9e1096172e9b68a629510818c5475119a1",
  );

  const quick = getPvpMatchOption(50);
  const standard = getPvpMatchOption(75);

  assert.equal(quick.queueType, "v3");
  assert.equal(quick.queueId, SUI_CONFIG.MATCHMAKING_QUEUE_V3_50_ID);
  assert.equal(standard.queueType, "v3");
  assert.equal(standard.queueId, SUI_CONFIG.MATCHMAKING_QUEUE_V3_75_ID);
});
