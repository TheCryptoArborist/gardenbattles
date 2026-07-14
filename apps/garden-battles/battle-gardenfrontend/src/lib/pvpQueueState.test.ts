import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPvpQueueCancelFunctionName,
  parsePvpQueueStateFromObject,
  resolvePvpQueueUiAfterRefund,
} from "./pvpQueueState";
import type { PvpMatchOption } from "./sui-config";

const wallet =
  "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";

const legacyOption: PvpMatchOption = {
  targetGrowth: 100,
  label: "Legacy Match",
  shortLabel: "100 Growth",
  queueId: "0xlegacy",
  queueType: "legacy",
};

const quickOption: PvpMatchOption = {
  targetGrowth: 50,
  label: "Quick Match",
  shortLabel: "50 Growth",
  queueId: "0xquick",
  queueType: "v2",
};

const standardOption: PvpMatchOption = {
  targetGrowth: 75,
  label: "Standard Match",
  shortLabel: "75 Growth",
  queueId: "0xstandard",
  queueType: "v2",
};

function queueObject(fields: Record<string, unknown>) {
  return {
    data: {
      content: {
        fields,
      },
    },
  };
}

function pending(player = wallet, entryFeeMist = "3000000000") {
  return {
    type: "0xpackage::matchmaking::Pending",
    fields: {
      entry_fee_snapshot: entryFeeMist,
      player,
    },
  };
}

describe("parsePvpQueueStateFromObject", () => {
  it("parses a recovered 50 Growth queue entry", () => {
    const state = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "50",
        waiting: pending(),
      }),
      wallet,
      quickOption,
    );

    assert.equal(state?.queueId, "0xquick");
    assert.equal(state?.queueType, "v2");
    assert.equal(state?.targetGrowth, 50);
    assert.equal(state?.entryFeeMist, 3000000000);
    assert.equal(getPvpQueueCancelFunctionName(state!.queueType), "cancel_queue_v2");
  });

  it("parses a recovered 75 Growth queue entry", () => {
    const state = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "75",
        waiting: pending(),
      }),
      wallet,
      standardOption,
    );

    assert.equal(state?.queueId, "0xstandard");
    assert.equal(state?.queueType, "v2");
    assert.equal(state?.targetGrowth, 75);
  });

  it("keeps the legacy refund path on legacy queue entries", () => {
    const state = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        waiting: pending(),
      }),
      wallet,
      legacyOption,
    );

    assert.equal(state?.queueId, "0xlegacy");
    assert.equal(state?.queueType, "legacy");
    assert.equal(state?.targetGrowth, 100);
    assert.equal(getPvpQueueCancelFunctionName(state!.queueType), "cancel_queue");
  });

  it("rejects a v2 queue target mismatch", () => {
    const state = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "75",
        waiting: pending(),
      }),
      wallet,
      quickOption,
    );

    assert.equal(state, null);
  });

  it("returns null when there is no matching waiting deposit", () => {
    const state = parsePvpQueueStateFromObject(
      queueObject({
        bank: "0",
        target_growth: "50",
        waiting: null,
      }),
      wallet,
      quickOption,
    );

    assert.equal(state, null);
  });

  it("successful 50 refund clears waiting UI recovery state", () => {
    const queueState = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "50",
        waiting: pending(),
      }),
      wallet,
      quickOption,
    );

    const result = resolvePvpQueueUiAfterRefund(
      {
        localPvpQueued: true,
        recoveredQueueState: queueState,
        activationKey: "0xquick:3000000000",
        recoveryWallet: wallet,
      },
      "success",
    );

    assert.equal(result.localPvpQueued, false);
    assert.equal(result.recoveredQueueState, null);
    assert.equal(result.activationKey, null);
    assert.equal(result.recoveryWallet, null);
  });

  it("successful 75 refund clears waiting UI recovery state", () => {
    const queueState = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "75",
        waiting: pending(),
      }),
      wallet,
      standardOption,
    );

    const result = resolvePvpQueueUiAfterRefund(
      {
        localPvpQueued: true,
        recoveredQueueState: queueState,
        activationKey: "0xstandard:3000000000",
        recoveryWallet: wallet,
      },
      "success",
    );

    assert.equal(result.localPvpQueued, false);
    assert.equal(result.recoveredQueueState, null);
  });

  it("successful legacy refund clears waiting UI recovery state", () => {
    const queueState = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        waiting: pending(),
      }),
      wallet,
      legacyOption,
    );

    const result = resolvePvpQueueUiAfterRefund(
      {
        localPvpQueued: true,
        recoveredQueueState: queueState,
        activationKey: "0xlegacy:3000000000",
        recoveryWallet: wallet,
      },
      "success",
    );

    assert.equal(result.localPvpQueued, false);
    assert.equal(result.recoveredQueueState, null);
  });

  it("failed refund preserves waiting UI recovery state", () => {
    const queueState = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "50",
        waiting: pending(),
      }),
      wallet,
      quickOption,
    );
    const current = {
      localPvpQueued: true,
      recoveredQueueState: queueState,
      activationKey: "0xquick:3000000000",
      recoveryWallet: wallet,
    };

    assert.equal(resolvePvpQueueUiAfterRefund(current, "failed"), current);
  });

  it("wallet rejection preserves waiting UI recovery state", () => {
    const queueState = parsePvpQueueStateFromObject(
      queueObject({
        bank: "3000000000",
        target_growth: "50",
        waiting: pending(),
      }),
      wallet,
      quickOption,
    );
    const current = {
      localPvpQueued: true,
      recoveredQueueState: queueState,
      activationKey: "0xquick:3000000000",
      recoveryWallet: wallet,
    };

    assert.equal(
      resolvePvpQueueUiAfterRefund(current, "wallet-rejected"),
      current,
    );
  });
});
