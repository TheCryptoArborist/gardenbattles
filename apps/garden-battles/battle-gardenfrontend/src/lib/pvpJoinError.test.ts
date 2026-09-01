import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPvpJoinFailureMessage,
  isWalletCancelMessage,
} from "./pvpJoinError";

test("wallet cancellation is shown clearly", () => {
  assert.equal(isWalletCancelMessage("User rejected the request"), true);
  assert.equal(
    formatPvpJoinFailureMessage("User rejected the request"),
    "Queue join cancelled in wallet.",
  );
});

test("NFT scan failures preserve the existing friendly copy", () => {
  assert.equal(
    formatPvpJoinFailureMessage("Could not scan your NFTrees because fetch failed"),
    "Could not scan your NFTrees because the Sui RPC request failed. Wait a moment and try again.",
  );
});

test("Move abort codes are mapped to actionable queue join messages", () => {
  assert.equal(
    formatPvpJoinFailureMessage("MoveAbort in command 0 with code 102"),
    "This wallet may already be waiting in that PvP queue. Check Queue Status before trying to join again.",
  );
  assert.equal(
    formatPvpJoinFailureMessage("MoveAbort in command 0 with code 104"),
    "The PvP entry payment did not match the on-chain entry fee. Refresh and try again.",
  );
  assert.equal(
    formatPvpJoinFailureMessage("MoveAbort in command 0 with code 113"),
    "The selected PvP match length is not active on-chain.",
  );
});

test("post-wallet transaction failures do not look like prep failures", () => {
  assert.equal(
    formatPvpJoinFailureMessage(
      "PvP queue transaction failed after wallet approval: Failed to fetch",
    ),
    "Wallet approval opened, but the queue transaction result could not be confirmed. Check your wallet activity before trying again.",
  );
});

test("post-wallet insufficient gas failures explain that the entry fee was not taken", () => {
  assert.equal(
    formatPvpJoinFailureMessage(
      "PvP queue transaction failed after wallet approval: InsufficientGas",
    ),
    "The wallet allowed too little gas for the PvP queue transaction. Your entry fee was not taken. Refresh and try again.",
  );
});

test("queue-prep RPC failures are not double-wrapped", () => {
  assert.equal(
    formatPvpJoinFailureMessage(
      "The Sui RPC request failed while preparing the queue join. Wait a moment and try again.",
    ),
    "The Sui RPC request failed while preparing the queue join. Wait a moment and try again.",
  );
});

test("unknown errors are included without raw URLs", () => {
  assert.equal(
    formatPvpJoinFailureMessage(
      "Unexpected failure while calling https://example.quicknode.pro/secret-token",
    ),
    "Could not join the PvP queue: Unexpected failure while calling [rpc-url]",
  );
});
