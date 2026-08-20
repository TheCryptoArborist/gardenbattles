import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PVP_JOIN_SYNCING_MESSAGE,
  buildSubmittedPvpJoinQueueState,
  classifyPvpJoinTransactionStatus,
  isTransientPvpJoinConfirmationError,
  resolvePvpJoinRecoveryOutcome,
} from "./pvpJoinRecovery";
import type { PvpMatchOption } from "./sui-config";

const wallet =
  "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";

const quickV3Option: PvpMatchOption = {
  targetGrowth: 50,
  label: "Quick Match",
  shortLabel: "50 Growth",
  queueId: "0xb380a69e611ad7636f2b7993fab6656c272c0802fd7a6ec35448a58956a0c38f",
  queueType: "v3",
};

const standardV3Option: PvpMatchOption = {
  targetGrowth: 75,
  label: "Standard Match",
  shortLabel: "75 Growth",
  queueId: "0x03e77c44e4ef2a6203a0d84378a4a8faf3acfb82ddfef84cd5e0bb243ff5abe1",
  queueType: "v3",
};

describe("isTransientPvpJoinConfirmationError", () => {
  it("keeps wallet rejection and missing digest failures hard before recovery", () => {
    assert.equal(
      isTransientPvpJoinConfirmationError(new Error("User rejected the request")),
      false,
    );
    assert.equal(
      isTransientPvpJoinConfirmationError(new Error("No transaction digest returned")),
      false,
    );
  });

  it("classifies post-digest confirmation timeout errors as transient", () => {
    assert.equal(
      isTransientPvpJoinConfirmationError(new Error("signal timed out")),
      true,
    );
    assert.equal(
      isTransientPvpJoinConfirmationError(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      ),
      true,
    );
    assert.equal(
      isTransientPvpJoinConfirmationError(
        Object.assign(new Error("Gateway Timeout"), { status: 504 }),
      ),
      true,
    );
  });

  it("classifies transport, rate-limit, and temporary gateway failures as transient", () => {
    assert.equal(
      isTransientPvpJoinConfirmationError(new Error("Failed to fetch")),
      true,
    );
    assert.equal(
      isTransientPvpJoinConfirmationError(
        Object.assign(new Error("Too Many Requests"), { response: { status: 429 } }),
      ),
      true,
    );
    assert.equal(
      isTransientPvpJoinConfirmationError(
        Object.assign(new Error("Service Unavailable"), { cause: { status: 503 } }),
      ),
      true,
    );
  });
});

describe("classifyPvpJoinTransactionStatus", () => {
  it("accepts confirmed successful effects", () => {
    assert.deepEqual(
      classifyPvpJoinTransactionStatus({
        effects: { status: { status: "success" } },
      }),
      { status: "success" },
    );
  });

  it("preserves explicit on-chain failure as a real join failure", () => {
    assert.deepEqual(
      classifyPvpJoinTransactionStatus({
        effects: {
          status: {
            status: "failure",
            error: "MoveAbort in command 0 with code 102",
          },
        },
      }),
      {
        status: "failed",
        error: "MoveAbort in command 0 with code 102",
      },
    );
  });
});

describe("resolvePvpJoinRecoveryOutcome", () => {
  it("returns waiting success when timeout recovery finds the wallet in the 50 Growth queue", () => {
    const queueState = buildSubmittedPvpJoinQueueState({
      address: wallet,
      entryFeeMist: 3_000_000_000,
      option: quickV3Option,
    });

    assert.deepEqual(
      resolvePvpJoinRecoveryOutcome({
        digest: "digest50",
        transactionStatus: { status: "success" },
        queueState,
      }),
      { status: "waiting", queueState },
    );
  });

  it("returns active-battle success when timeout recovery finds a battle", () => {
    assert.deepEqual(
      resolvePvpJoinRecoveryOutcome({
        digest: "digestBattle",
        transactionStatus: { status: "success" },
        activeBattleFound: true,
      }),
      { status: "active-battle" },
    );
  });

  it("keeps unresolved post-digest state as syncing instead of failed", () => {
    assert.deepEqual(
      resolvePvpJoinRecoveryOutcome({
        digest: "digestUnresolved",
        transactionStatus: null,
        queueState: null,
        activeBattleFound: false,
      }),
      {
        status: "syncing",
        digest: "digestUnresolved",
        message: PVP_JOIN_SYNCING_MESSAGE,
      },
    );
  });

  it("keeps 75 Growth V3 routing isolated while building unresolved queue state", () => {
    const queueState = buildSubmittedPvpJoinQueueState({
      address: wallet,
      entryFeeMist: 3_000_000_000,
      option: standardV3Option,
    });

    assert.equal(queueState.queueId, standardV3Option.queueId);
    assert.equal(queueState.queueType, "v3");
    assert.equal(queueState.targetGrowth, 75);
    assert.equal(queueState.matchLabel, "Standard Match - First to 75 Growth");
  });

  it("does not downgrade explicit on-chain failure to syncing", () => {
    assert.deepEqual(
      resolvePvpJoinRecoveryOutcome({
        digest: "digestFailed",
        transactionStatus: {
          status: "failed",
          error: "MoveAbort in command 0 with code 104",
        },
      }),
      {
        status: "failed",
        error: "MoveAbort in command 0 with code 104",
      },
    );
  });
});
