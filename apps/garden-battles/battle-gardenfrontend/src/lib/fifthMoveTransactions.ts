import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";
import type { FifthMoveProof } from "./fifthMoveRouting";

export type PvpQueueTypeForJoin = "legacy" | "v2" | "v3";

export type DirectPvpJoinInput = {
  packageId: string;
  configId: string;
  fifthMoveConfigId?: string;
  queueId: string;
  nftId: string;
  nftType: string;
  queueType: PvpQueueTypeForJoin;
  entryFeeMist: number | string | bigint;
  randomObjectId: string;
  sender?: string;
  fifthMoveProof?: FifthMoveProof | null;
};

function makeFeeCoin(tx: Transaction, entryFeeMist: number | string | bigint): TransactionArgument {
  const fee = BigInt(entryFeeMist);
  if (fee === BigInt(0)) {
    return tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: ["0x2::sui::SUI"],
      arguments: [],
    });
  }
  return tx.splitCoins(tx.gas, [tx.pure.u64(fee)])[0];
}

export function buildDirectPvpJoinTransaction(input: DirectPvpJoinInput): {
  tx: Transaction;
  functionName: string;
  usesFifthMoveProof: boolean;
} {
  const tx = new Transaction();
  const fee = makeFeeCoin(tx, input.entryFeeMist);
  const proof = input.queueType === "v3" ? input.fifthMoveProof : null;
  const usesFifthMoveProof = Boolean(proof);
  const functionName =
    input.queueType === "v3"
      ? proof
        ? "join_queue_v3_with_fifth_move"
        : "join_queue_v3"
      : input.queueType === "v2"
        ? "join_queue_v2"
        : "join_queue";

  const args =
    input.queueType === "v3" && proof
      ? [
          tx.object(input.configId),
          tx.object(input.fifthMoveConfigId ?? ""),
          tx.object(input.queueId),
          tx.object(input.nftId),
          fee,
          tx.pure.vector("u8", proof.signatureBytes),
          tx.pure.bool(proof.payload.qualified),
          tx.pure.u64(proof.payload.verified_underlying_tree_raw),
          tx.pure.u64(proof.payload.threshold_raw),
          tx.pure.u8(proof.payload.source_bitmap),
          tx.pure.u64(proof.payload.config_version),
          tx.pure.u64(proof.payload.issued_at_ms),
          tx.pure.u64(proof.payload.expires_at_ms),
          tx.object("0x6"),
          tx.object(input.randomObjectId),
        ]
      : [
          tx.object(input.configId),
          tx.object(input.queueId),
          tx.object(input.nftId),
          fee,
          tx.object(input.randomObjectId),
        ];

  tx.moveCall({
    target: `${input.packageId}::matchmaking::${functionName}`,
    typeArguments: [input.nftType],
    arguments: args,
  });

  if (input.sender) {
    tx.setSender(input.sender);
  }

  return { tx, functionName, usesFifthMoveProof };
}
