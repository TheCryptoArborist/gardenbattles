import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";
import type { FifthMoveProof } from "./fifthMoveRouting";

// Queue joins create and mutate several on-chain objects. Some mobile wallets
// underestimate that storage work during gas simulation, so give joins the same
// explicit safety ceiling used by PvP moves. This is a maximum, not a fixed fee.
export const PVP_JOIN_GAS_BUDGET_MIST = 20_000_000;

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

export type KioskPvpJoinInput = Omit<DirectPvpJoinInput, "nftId"> & {
  kioskId: string;
  kioskCapId: string;
  nftId: string;
};

export type RankedBotBattleInput = {
  packageId: string;
  configId: string;
  fifthMoveConfigId?: string;
  nftId: string;
  nftType: string;
  botAddress: string;
  randomObjectId: string;
  sender?: string;
  fifthMoveProof?: FifthMoveProof | null;
};

export type RankedBotBattleFromKioskInput = Omit<RankedBotBattleInput, "nftId"> & {
  kioskId: string;
  kioskCapId: string;
  nftId: string;
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

function fifthMoveArgs(tx: Transaction, proof: FifthMoveProof): TransactionArgument[] {
  return [
    tx.pure.vector("u8", proof.signatureBytes),
    tx.pure.bool(proof.payload.qualified),
    tx.pure.u64(proof.payload.verified_underlying_tree_raw),
    tx.pure.u64(proof.payload.threshold_raw),
    tx.pure.u8(proof.payload.source_bitmap),
    tx.pure.u64(proof.payload.config_version),
    tx.pure.u64(proof.payload.issued_at_ms),
    tx.pure.u64(proof.payload.expires_at_ms),
  ];
}

export function buildDirectPvpJoinTransaction(input: DirectPvpJoinInput): {
  tx: Transaction;
  functionName: string;
  usesFifthMoveProof: boolean;
} {
  const tx = new Transaction();
  tx.setGasBudget(PVP_JOIN_GAS_BUDGET_MIST);
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
          ...fifthMoveArgs(tx, proof),
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

export function buildKioskPvpJoinTransaction(input: KioskPvpJoinInput): {
  tx: Transaction;
  functionName: string;
  usesFifthMoveProof: boolean;
} {
  const tx = new Transaction();
  tx.setGasBudget(PVP_JOIN_GAS_BUDGET_MIST);
  const fee = makeFeeCoin(tx, input.entryFeeMist);
  const proof = input.queueType === "v3" ? input.fifthMoveProof : null;
  const usesFifthMoveProof = Boolean(proof);
  const functionName =
    input.queueType === "v3"
      ? proof
        ? "join_queue_v3_with_fifth_move_from_kiosk"
        : "join_queue_v3_from_kiosk"
      : input.queueType === "v2"
        ? "join_queue_v2_from_kiosk"
        : "join_queue_from_kiosk";

  const args =
    input.queueType === "v3" && proof
      ? [
          tx.object(input.configId),
          tx.object(input.fifthMoveConfigId ?? ""),
          tx.object(input.queueId),
          tx.object(input.kioskId),
          tx.object(input.kioskCapId),
          tx.pure.address(input.nftId),
          fee,
          ...fifthMoveArgs(tx, proof),
          tx.object("0x6"),
          tx.object(input.randomObjectId),
        ]
      : [
          tx.object(input.configId),
          tx.object(input.queueId),
          tx.object(input.kioskId),
          tx.object(input.kioskCapId),
          tx.pure.address(input.nftId),
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

export function buildRankedBotBattleTransaction(input: RankedBotBattleInput): {
  tx: Transaction;
  functionName: string;
  usesFifthMoveProof: boolean;
} {
  const tx = new Transaction();
  const proof = input.fifthMoveProof ?? null;
  const usesFifthMoveProof = Boolean(proof);
  const functionName = proof
    ? "create_ranked_bot_battle_v2_with_fifth_move"
    : input.fifthMoveConfigId
      ? "create_ranked_bot_battle_v2_standard"
      : "create_bot_battle";
  const args = proof
    ? [
        tx.object(input.configId),
        tx.object(input.fifthMoveConfigId ?? ""),
        tx.object(input.nftId),
        tx.pure.address(input.botAddress),
        ...fifthMoveArgs(tx, proof),
        tx.object("0x6"),
        tx.object(input.randomObjectId),
      ]
    : [
        tx.object(input.configId),
        tx.object(input.nftId),
        tx.pure.address(input.botAddress),
        tx.object(input.randomObjectId),
      ];

  tx.moveCall({
    target: `${input.packageId}::battle::${functionName}`,
    typeArguments: [input.nftType],
    arguments: args,
  });

  if (input.sender) {
    tx.setSender(input.sender);
  }

  return { tx, functionName, usesFifthMoveProof };
}

export function buildRankedBotBattleFromKioskTransaction(input: RankedBotBattleFromKioskInput): {
  tx: Transaction;
  functionName: string;
  usesFifthMoveProof: boolean;
} {
  const tx = new Transaction();
  const proof = input.fifthMoveProof ?? null;
  const usesFifthMoveProof = Boolean(proof);
  const functionName = proof
    ? "create_ranked_bot_battle_v2_with_fifth_move_from_kiosk"
    : input.fifthMoveConfigId
      ? "create_ranked_bot_battle_v2_standard_from_kiosk"
      : "create_bot_battle_from_kiosk";
  const args = proof
    ? [
        tx.object(input.configId),
        tx.object(input.fifthMoveConfigId ?? ""),
        tx.object(input.kioskId),
        tx.object(input.kioskCapId),
        tx.pure.address(input.nftId),
        tx.pure.address(input.botAddress),
        ...fifthMoveArgs(tx, proof),
        tx.object("0x6"),
        tx.object(input.randomObjectId),
      ]
    : [
        tx.object(input.configId),
        tx.object(input.kioskId),
        tx.object(input.kioskCapId),
        tx.pure.address(input.nftId),
        tx.pure.address(input.botAddress),
        tx.object(input.randomObjectId),
      ];

  tx.moveCall({
    target: `${input.packageId}::battle::${functionName}`,
    typeArguments: [input.nftType],
    arguments: args,
  });

  if (input.sender) {
    tx.setSender(input.sender);
  }

  return { tx, functionName, usesFifthMoveProof };
}
