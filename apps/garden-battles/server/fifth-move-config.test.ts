import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExpectedSignerPublicKey,
  parseBattleEvent,
  parseMoveTypeName,
  parseMoveU64,
  parseMoveU8Vector,
  validateLiveFifthMoveConfigFields,
} from "./routes";
import { TREE_COIN_TYPE } from "../shared/tree-power-eligibility";

const PLAYER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PLAYER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

test("live FifthMoveConfig field parsers accept canonical Move shapes", () => {
  assert.equal(parseMoveU64("1000000000000"), "1000000000000");
  assert.equal(parseMoveU64(123), "123");
  assert.equal(parseMoveU64(123n), "123");
  assert.equal(parseMoveTypeName(TREE_COIN_TYPE), TREE_COIN_TYPE);
  assert.equal(parseMoveTypeName({ fields: { name: TREE_COIN_TYPE } }), TREE_COIN_TYPE);
  assert.deepEqual(Array.from(parseMoveU8Vector([1, 2, 3]) ?? []), [1, 2, 3]);
  assert.deepEqual(
    Array.from(parseMoveU8Vector({ fields: { contents: [4, 5, 6] } }) ?? []),
    [4, 5, 6],
  );
});

test("live FifthMoveConfig signer parser accepts GraphQL Base64 vectors", () => {
  const signer = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
  assert.deepEqual(
    parseMoveU8Vector(Buffer.from(signer).toString("base64")),
    signer,
  );
  assert.equal(parseMoveU8Vector("not base64"), null);
});

test("live FifthMoveConfig field parsers reject malformed values", () => {
  assert.equal(parseMoveU64("-1"), null);
  assert.equal(parseMoveU64(1.5), null);
  assert.equal(parseMoveTypeName({ fields: { name: 1 } }), null);
  assert.equal(parseMoveU8Vector([256]), null);
  assert.equal(parseMoveU8Vector(["1"]), null);
});

test("signer public key validation catches malformed and mismatched keys", () => {
  const key = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
  assert.doesNotThrow(() => assertExpectedSignerPublicKey(key, key));
  assert.throws(
    () => assertExpectedSignerPublicKey(Uint8Array.from([1, 2, 3]), key),
    /fifth_move_config_malformed_signer/,
  );
  assert.throws(
    () => assertExpectedSignerPublicKey(key, Uint8Array.from([1, 2, 3])),
    /fifth_move_server_signer_malformed/,
  );
  assert.throws(
    () => assertExpectedSignerPublicKey(key, Uint8Array.from(Array.from({ length: 32 }, () => 9))),
    /fifth_move_signer_mismatch/,
  );
});

function validParsedConfig(overrides: Partial<Parameters<typeof validateLiveFifthMoveConfigFields>[0]> = {}) {
  const signerPublicKey = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
  return {
    config: {
      id: "0x083a9303bd13b789e87f3e746b817a8723290f25414f3686ac8868f90a5020b3",
      enabled: true,
      utilityCoin: TREE_COIN_TYPE,
      minUnderlyingTreeRaw: "1000000000000",
      signerPublicKey,
      configVersion: "1",
      maxAttestationAgeMs: "180000",
      ...overrides,
    },
    signerPublicKey,
  };
}

test("disabled FifthMoveConfig with matching signer validates fields before returning disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({ enabled: false });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_disabled/,
  );
});

test("disabled FifthMoveConfig with mismatched signer returns signer mismatch before disabled", () => {
  const { config } = validParsedConfig({ enabled: false });
  const wrongServerSigner = Uint8Array.from(Array.from({ length: 32 }, () => 9));

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, wrongServerSigner),
    /fifth_move_signer_mismatch/,
  );
});

test("disabled FifthMoveConfig with malformed public key returns malformed signer before disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({
    enabled: false,
    signerPublicKey: Uint8Array.from([1, 2, 3]),
  });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_malformed_signer/,
  );
});

test("disabled FifthMoveConfig validates TREE utility before returning disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({
    enabled: false,
    utilityCoin: "0x2::sui::SUI",
  });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_wrong_utility_coin/,
  );
});

test("disabled FifthMoveConfig validates threshold before returning disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({
    enabled: false,
    minUnderlyingTreeRaw: "0",
  });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_invalid_threshold/,
  );
});

test("disabled FifthMoveConfig validates config version before returning disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({
    enabled: false,
    configVersion: "0",
  });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_invalid_version/,
  );
});

test("disabled FifthMoveConfig validates max age before returning disabled", () => {
  const { config, signerPublicKey } = validParsedConfig({
    enabled: false,
    maxAttestationAgeMs: "0",
  });

  assert.throws(
    () => validateLiveFifthMoveConfigFields(config, signerPublicKey),
    /fifth_move_config_invalid_max_age/,
  );
});

test("enabled FifthMoveConfig with matching signer returns validated config", () => {
  const { config, signerPublicKey } = validParsedConfig();

  const validated = validateLiveFifthMoveConfigFields(config, signerPublicKey);

  assert.equal(validated.enabled, true);
  assert.equal(validated.utilityCoin, TREE_COIN_TYPE);
  assert.equal(validated.minUnderlyingTreeRaw, "1000000000000");
  assert.equal(validated.configVersion, "1");
  assert.equal(validated.maxAttestationAgeMs, "180000");
  assert.deepEqual(Array.from(validated.signerPublicKey), Array.from(signerPublicKey));
});

test("live FifthMoveConfig utility coin validation accepts normalized TypeName addresses", () => {
  const { config, signerPublicKey } = validParsedConfig({
    utilityCoin: TREE_COIN_TYPE.replace(/^0x/, ""),
  });

  const validated = validateLiveFifthMoveConfigFields(config, signerPublicKey);

  assert.equal(validated.utilityCoin, TREE_COIN_TYPE);
});

test("PvpBattleV3Update parsing preserves target and ignores entitlement for scoring", () => {
  const event = parseBattleEvent(
    {
      battle_id: "0xv3",
      player1: PLAYER_A,
      player2: PLAYER_B,
      player1_growth: "50",
      player2_growth: "44",
      player1_moves: [1, 2, 20, 9, 29],
      player2_moves: [3, 4, 21, 27],
      winner: PLAYER_A,
      target_growth: "50",
      last_move_ms: "456",
      p1_fifth_move_entitled: true,
      p2_fifth_move_entitled: false,
    },
    "pvp-v3",
  );

  assert.equal(event?.battleVersion, "pvp-v3");
  assert.equal(event?.targetGrowth, 50);
  assert.equal(event?.winner, PLAYER_A);
  assert.equal(event?.player1Moves.length, 5);
});

test("RankedBotBattleV2Update parsing stores bot mode and target growth", () => {
  const event = parseBattleEvent(
    {
      battle_id: "0xbot",
      player1: PLAYER_A,
      player2: PLAYER_B,
      player1_growth: "50",
      player2_growth: "20",
      player1_moves: [1, 2, 20, 9, 29],
      player2_moves: [3, 4, 21, 27],
      winner: PLAYER_A,
      target_growth: "50",
      last_move_ms: "789",
      p1_fifth_move_entitled: true,
    },
    "bot-v2",
  );

  assert.equal(event?.battleVersion, "bot-v2");
  assert.equal(event?.isBotBattle, true);
  assert.equal(event?.targetGrowth, 50);
  assert.equal(event?.player1Moves.length, 5);
});
