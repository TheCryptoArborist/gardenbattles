import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPostRefundQueueSnapshot,
  getPvpQueueCancelMoveCall,
  getPvpQueueCancelFunctionName,
  parsePvpQueueObjectSnapshot,
  parsePvpQueueStateFromObject,
  resolvePvpQueueUiAfterRefund,
} from "./pvpQueueState";
import type { PvpMatchOption } from "./sui-config";

const wallet =
  "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";
const legacyQueue =
  "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d";
const quickQueue =
  "0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960";
const standardQueue =
  "0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd";
const packageId =
  "0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23";

const legacyOption: PvpMatchOption = {
  targetGrowth: 100,
  label: "Legacy Match",
  shortLabel: "100 Growth",
  queueId: legacyQueue,
  queueType: "legacy",
};

const quickOption: PvpMatchOption = {
  targetGrowth: 50,
  label: "Quick Match",
  shortLabel: "50 Growth",
  queueId: quickQueue,
  queueType: "v2",
};

const standardOption: PvpMatchOption = {
  targetGrowth: 75,
  label: "Standard Match",
  shortLabel: "75 Growth",
  queueId: standardQueue,
  queueType: "v2",
};

function queueObject(
  fields: Record<string, unknown>,
  meta: { previousTransaction?: string; version?: string } = {},
) {
  return {
    data: {
      previousTransaction: meta.previousTransaction,
      version: meta.version,
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

    assert.equal(state?.queueId, quickQueue);
    assert.equal(state?.queueType, "v2");
    assert.equal(state?.targetGrowth, 50);
    assert.equal(state?.entryFeeMist, 3000000000);
    assert.equal(getPvpQueueCancelFunctionName(state!.queueType), "cancel_queue_v2");
    assert.deepEqual(getPvpQueueCancelMoveCall(packageId, state!), {
      target: `${packageId}::matchmaking::cancel_queue_v2`,
      queueObjectId: quickQueue,
    });
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

    assert.equal(state?.queueId, standardQueue);
    assert.equal(state?.queueType, "v2");
    assert.equal(state?.targetGrowth, 75);
    assert.deepEqual(getPvpQueueCancelMoveCall(packageId, state!), {
      target: `${packageId}::matchmaking::cancel_queue_v2`,
      queueObjectId: standardQueue,
    });
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

    assert.equal(state?.queueId, legacyQueue);
    assert.equal(state?.queueType, "legacy");
    assert.equal(state?.targetGrowth, 100);
    assert.equal(getPvpQueueCancelFunctionName(state!.queueType), "cancel_queue");
    assert.deepEqual(getPvpQueueCancelMoveCall(packageId, state!), {
      target: `${packageId}::matchmaking::cancel_queue`,
      queueObjectId: legacyQueue,
    });
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

  it("treats a stale pre-refund object as stale before a later cleared object", () => {
    const refundDigest = "9refundDigest";
    const staleSnapshot = parsePvpQueueObjectSnapshot(
      queueObject(
        {
          bank: "3000000000",
          target_growth: "50",
          waiting: pending(),
        },
        { previousTransaction: "oldJoinDigest", version: "18" },
      ),
      wallet,
      quickOption,
    );
    const clearedSnapshot = parsePvpQueueObjectSnapshot(
      queueObject(
        {
          bank: "0",
          target_growth: "50",
          waiting: null,
        },
        { previousTransaction: refundDigest, version: "19" },
      ),
      wallet,
      quickOption,
    );

    assert.equal(
      classifyPostRefundQueueSnapshot(staleSnapshot, refundDigest),
      "stale",
    );
    assert.equal(
      classifyPostRefundQueueSnapshot(clearedSnapshot, refundDigest),
      "cleared",
    );
  });

  it("treats previousTransaction mismatch with a waiting entry as stale", () => {
    const snapshot = parsePvpQueueObjectSnapshot(
      queueObject(
        {
          bank: "3000000000",
          target_growth: "75",
          waiting: pending(),
        },
        { previousTransaction: "notTheRefundDigest", version: "22" },
      ),
      wallet,
      standardOption,
    );

    assert.equal(
      classifyPostRefundQueueSnapshot(snapshot, "refundDigest"),
      "stale",
    );
  });

  it("treats a confirmed cleared queue as normal success", () => {
    const refundDigest = "7confirmedRefund";
    const snapshot = parsePvpQueueObjectSnapshot(
      queueObject(
        {
          bank: "0",
          target_growth: "50",
          waiting: null,
        },
        { previousTransaction: refundDigest, version: "30" },
      ),
      wallet,
      quickOption,
    );

    assert.equal(snapshot.queueState, null);
    assert.equal(snapshot.previousTransaction, refundDigest);
    assert.equal(snapshot.version, "30");
    assert.equal(snapshot.bankMist, 0);
    assert.equal(classifyPostRefundQueueSnapshot(snapshot, refundDigest), "cleared");
  });

  it("does not restore waiting UI state when verification remains stale after success", () => {
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
  });

  it("warns only when the current queue object still shows the wallet waiting", () => {
    const refundDigest = "currentRefundDigest";
    const snapshot = parsePvpQueueObjectSnapshot(
      queueObject(
        {
          bank: "3000000000",
          target_growth: "50",
          waiting: pending(),
        },
        { previousTransaction: refundDigest, version: "41" },
      ),
      wallet,
      quickOption,
    );

    assert.equal(
      classifyPostRefundQueueSnapshot(snapshot, refundDigest),
      "still-waiting",
    );
  });
});
