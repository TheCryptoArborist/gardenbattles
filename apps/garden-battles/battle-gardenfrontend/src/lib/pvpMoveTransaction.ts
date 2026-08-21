import { Transaction } from "@mysten/sui/transactions";

export function addPvpMoveRequestNonce(
  transaction: Transaction,
  nonce = Date.now(),
): void {
  // Some mobile wallet bridges suppress a repeated transaction request when its
  // JSON is byte-identical to an earlier request. An unused pure input keeps the
  // wallet request unique without changing the Move call or its on-chain effect.
  transaction.pure.u64(BigInt(nonce));
}
