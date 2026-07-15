import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getQueueClearTransitionKey,
  resolvePvpHydrationMode,
  shouldRunQueueClearDiscovery,
  shouldSuppressQueueRecovery,
} from "./pvpQueueLifecycle";
import type { ParsedPvpQueueState } from "./pvpQueueState";

const wallet =
  "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";

const quickQueueState: ParsedPvpQueueState = {
  queueId: "0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960",
  player: wallet,
  entryFeeMist: 3000000000,
  targetGrowth: 50,
  matchLabel: "Quick Match - First to 50 Growth",
  queueType: "v2",
};

describe("pvp queue lifecycle helpers", () => {
  it("active battle suppresses queue recovery polling", () => {
    assert.equal(
      shouldSuppressQueueRecovery({
        isConnected: true,
        address: wallet,
        hasActiveBattle: true,
      }),
      true,
    );
  });

  it("active battle does not count as prior queue state", () => {
    const result = shouldRunQueueClearDiscovery({
      previousQueueState: null,
      hasActiveBattle: true,
      inFlight: false,
      lastDiscoveryKey: null,
      wallet,
    });

    assert.equal(result.shouldRun, false);
    assert.equal(result.key, null);
  });

  it("confirmed waiting queue changing to empty triggers one discovery", () => {
    const result = shouldRunQueueClearDiscovery({
      previousQueueState: quickQueueState,
      hasActiveBattle: false,
      inFlight: false,
      lastDiscoveryKey: null,
      wallet,
    });

    assert.equal(result.shouldRun, true);
    assert.equal(result.key, getQueueClearTransitionKey(wallet, quickQueueState));
  });

  it("repeated empty queue checks do not trigger repeated discovery", () => {
    const key = getQueueClearTransitionKey(wallet, quickQueueState);
    const result = shouldRunQueueClearDiscovery({
      previousQueueState: quickQueueState,
      hasActiveBattle: false,
      inFlight: false,
      lastDiscoveryKey: key,
      wallet,
    });

    assert.equal(result.shouldRun, false);
    assert.equal(result.key, key);
  });

  it("same-battle hydration routes through apply update", () => {
    assert.equal(
      resolvePvpHydrationMode({
        currentBattleId: "0xabc",
        nextBattleId: "0xABC",
        hasCurrentActiveBattle: true,
      }),
      "apply-update",
    );
  });

  it("initial battle recovery may initialize state", () => {
    assert.equal(
      resolvePvpHydrationMode({
        currentBattleId: null,
        nextBattleId: "0xabc",
        hasCurrentActiveBattle: false,
      }),
      "initialize",
    );
  });
});
