import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDirectPvpJoinTransaction,
  buildKioskPvpJoinTransaction,
  buildRankedBotBattleFromKioskTransaction,
  buildRankedBotBattleTransaction,
} from "./fifthMoveTransactions";
import type { FifthMoveProof } from "./fifthMoveRouting";

const PACKAGE_ID = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CONFIG_ID = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FIFTH_CONFIG_ID = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const QUEUE_ID = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const NFT_ID = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const KIOSK_ID = "0x1111111111111111111111111111111111111111111111111111111111111111";
const KIOSK_CAP_ID = "0x2222222222222222222222222222222222222222222222222222222222222222";
const BOT_ADDRESS = "0x3333333333333333333333333333333333333333333333333333333333333333";
const RANDOM_ID = "0x8";
const NFT_TYPE = `${PACKAGE_ID}::test_nft::TestNFT`;
const SENDER = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function proof(): FifthMoveProof {
  return {
    signatureBytes: Array.from({ length: 64 }, (_, i) => i),
    payload: {
      version: 1,
      domain: Array.from(new TextEncoder().encode("GARDEN_BATTLES_FIFTH_MOVE_V1")),
      network: Array.from(new TextEncoder().encode("sui:mainnet")),
      fifth_move_config_id: FIFTH_CONFIG_ID,
      wallet: SENDER,
      qualified: true,
      verified_underlying_tree_raw: "2500000000000",
      threshold_raw: "1000000000000",
      source_bitmap: 4,
      config_version: "1",
      issued_at_ms: "1000",
      expires_at_ms: "61000",
    },
  };
}

function moveCallData(txData: any): any {
  const commands = txData.commands ?? txData.transactions ?? [];
  const command = commands.find((candidate: any) => candidate?.MoveCall || candidate?.$kind === "MoveCall");
  if (!command) return null;
  if (command.MoveCall) return command.MoveCall;
  if (command.$kind === "MoveCall") return command.MoveCall;
  return null;
}

function hasObjectInput(txData: any, objectId: string): boolean {
  const normalized = objectId.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return (txData.inputs ?? []).some((input: any) => {
    const found = input?.UnresolvedObject?.objectId;
    return typeof found === "string" && found.toLowerCase().replace(/^0x/, "").padStart(64, "0") === normalized;
  });
}

test("direct v3 qualified join uses join_queue_v3_with_fifth_move and Clock 0x6", () => {
  const built = buildDirectPvpJoinTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    queueId: QUEUE_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    queueType: "v3",
    entryFeeMist: 3_000_000_000,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: proof(),
  });

  const data = built.tx.getData() as any;
  assert.equal(built.functionName, "join_queue_v3_with_fifth_move");
  assert.equal(built.usesFifthMoveProof, true);
  assert.equal(data.sender, SENDER);
  assert.equal(moveCallData(data).package, PACKAGE_ID);
  assert.equal(moveCallData(data).module, "matchmaking");
  assert.equal(moveCallData(data).function, "join_queue_v3_with_fifth_move");
  assert.equal(hasObjectInput(data, "0x6"), true);
});

test("direct v3 standard join uses join_queue_v3 without proof or Clock", () => {
  const built = buildDirectPvpJoinTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    queueId: QUEUE_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    queueType: "v3",
    entryFeeMist: 3_000_000_000,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: null,
  });

  const data = built.tx.getData() as any;
  assert.equal(built.functionName, "join_queue_v3");
  assert.equal(built.usesFifthMoveProof, false);
  assert.equal(moveCallData(data).package, PACKAGE_ID);
  assert.equal(moveCallData(data).module, "matchmaking");
  assert.equal(moveCallData(data).function, "join_queue_v3");
  assert.equal(hasObjectInput(data, "0x6"), false);
});

test("direct legacy and v2 joins preserve their existing function names", () => {
  assert.equal(
    buildDirectPvpJoinTransaction({
      packageId: PACKAGE_ID,
      configId: CONFIG_ID,
      queueId: QUEUE_ID,
      nftId: NFT_ID,
      nftType: NFT_TYPE,
      queueType: "legacy",
      entryFeeMist: 3_000_000_000,
      randomObjectId: RANDOM_ID,
    }).functionName,
    "join_queue",
  );
  assert.equal(
    buildDirectPvpJoinTransaction({
      packageId: PACKAGE_ID,
      configId: CONFIG_ID,
      queueId: QUEUE_ID,
      nftId: NFT_ID,
      nftType: NFT_TYPE,
      queueType: "v2",
      entryFeeMist: 3_000_000_000,
      randomObjectId: RANDOM_ID,
    }).functionName,
    "join_queue_v2",
  );
});

test("kiosk v3 qualified join uses join_queue_v3_with_fifth_move_from_kiosk and Clock 0x6", () => {
  const built = buildKioskPvpJoinTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    queueId: QUEUE_ID,
    kioskId: KIOSK_ID,
    kioskCapId: KIOSK_CAP_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    queueType: "v3",
    entryFeeMist: 3_000_000_000,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: proof(),
  });

  const data = built.tx.getData() as any;
  assert.equal(built.functionName, "join_queue_v3_with_fifth_move_from_kiosk");
  assert.equal(built.usesFifthMoveProof, true);
  assert.equal(moveCallData(data).module, "matchmaking");
  assert.equal(moveCallData(data).function, "join_queue_v3_with_fifth_move_from_kiosk");
  assert.equal(hasObjectInput(data, "0x6"), true);
});

test("kiosk v3 standard join uses join_queue_v3_from_kiosk without proof or Clock", () => {
  const built = buildKioskPvpJoinTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    queueId: QUEUE_ID,
    kioskId: KIOSK_ID,
    kioskCapId: KIOSK_CAP_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    queueType: "v3",
    entryFeeMist: 3_000_000_000,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: null,
  });

  const data = built.tx.getData() as any;
  assert.equal(built.functionName, "join_queue_v3_from_kiosk");
  assert.equal(built.usesFifthMoveProof, false);
  assert.equal(moveCallData(data).module, "matchmaking");
  assert.equal(moveCallData(data).function, "join_queue_v3_from_kiosk");
  assert.equal(hasObjectInput(data, "0x6"), false);
});

test("ranked bot direct and kiosk builders select qualified functions with Clock 0x6", () => {
  const direct = buildRankedBotBattleTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    botAddress: BOT_ADDRESS,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: proof(),
  });
  const kiosk = buildRankedBotBattleFromKioskTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    kioskId: KIOSK_ID,
    kioskCapId: KIOSK_CAP_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    botAddress: BOT_ADDRESS,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: proof(),
  });

  assert.equal(direct.functionName, "create_ranked_bot_battle_v2_with_fifth_move");
  assert.equal(kiosk.functionName, "create_ranked_bot_battle_v2_with_fifth_move_from_kiosk");
  assert.equal(hasObjectInput(direct.tx.getData(), "0x6"), true);
  assert.equal(hasObjectInput(kiosk.tx.getData(), "0x6"), true);
});

test("ranked bot direct and kiosk builders select standard functions without Clock", () => {
  const direct = buildRankedBotBattleTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    botAddress: BOT_ADDRESS,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: null,
  });
  const kiosk = buildRankedBotBattleFromKioskTransaction({
    packageId: PACKAGE_ID,
    configId: CONFIG_ID,
    fifthMoveConfigId: FIFTH_CONFIG_ID,
    kioskId: KIOSK_ID,
    kioskCapId: KIOSK_CAP_ID,
    nftId: NFT_ID,
    nftType: NFT_TYPE,
    botAddress: BOT_ADDRESS,
    randomObjectId: RANDOM_ID,
    sender: SENDER,
    fifthMoveProof: null,
  });

  assert.equal(direct.functionName, "create_ranked_bot_battle_v2_standard");
  assert.equal(kiosk.functionName, "create_ranked_bot_battle_v2_standard_from_kiosk");
  assert.equal(hasObjectInput(direct.tx.getData(), "0x6"), false);
  assert.equal(hasObjectInput(kiosk.tx.getData(), "0x6"), false);
});
