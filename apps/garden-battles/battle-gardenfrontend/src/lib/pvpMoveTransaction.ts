import { Transaction } from "@mysten/sui/transactions";

// Randomized battle abilities can consume more gas than the wallet's dry-run
// estimate. This is a maximum allowance, not a fixed charge; Sui only charges
// the gas the transaction actually uses.
export const BATTLE_MOVE_GAS_BUDGET_MIST = 20_000_000;

export function addPvpMoveRequestNonce(
  transaction: Transaction,
  nonce = Date.now(),
): void {
  // Some mobile wallet bridges suppress a repeated transaction request when its
  // JSON is byte-identical to an earlier request. An unused pure input keeps the
  // wallet request unique without changing the Move call or its on-chain effect.
  transaction.pure.u64(BigInt(nonce));
}

export function setBattleMoveGasBudget(transaction: Transaction): void {
  transaction.setGasBudget(BATTLE_MOVE_GAS_BUDGET_MIST);
}
