import type { FifthMoveAttestationPayload } from "../../../shared/fifth-move-attestation";

export const FIFTH_MOVE_CLOCK_OBJECT_ID = "0x6";

export interface FifthMoveProof {
  payload: FifthMoveAttestationPayload;
  signatureBytes: number[];
}

export type ProofRoute =
  | "pvp-direct"
  | "pvp-kiosk"
  | "ranked-bot-direct"
  | "ranked-bot-kiosk";

export function isUsableFifthMoveProof(
  proof: FifthMoveProof | null | undefined,
  expectedConfigId: string,
): proof is FifthMoveProof {
  if (!proof || !expectedConfigId.trim()) return false;
  const payload = proof.payload;
  if (!payload || !Array.isArray(proof.signatureBytes)) return false;
  if (proof.signatureBytes.length !== 64) return false;
  if (String(payload.fifth_move_config_id ?? "").toLowerCase() !== expectedConfigId.toLowerCase()) {
    return false;
  }
  if (payload.qualified !== true) return false;
  const sourceBitmap = Number(payload.source_bitmap);
  // TREE Lock uses bit 4 (decimal 16), so the complete supported source mask
  // spans five bits. Keep this aligned with the server and on-chain config.
  if (!Number.isInteger(sourceBitmap) || sourceBitmap <= 0 || sourceBitmap > 31) return false;

  const amount = BigInt(String(payload.verified_underlying_tree_raw ?? "0"));
  const threshold = BigInt(String(payload.threshold_raw ?? "0"));
  const configVersion = BigInt(String(payload.config_version ?? "0"));
  const issuedAt = BigInt(String(payload.issued_at_ms ?? "0"));
  const expiresAt = BigInt(String(payload.expires_at_ms ?? "0"));
  return (
    amount >= threshold &&
    threshold > BigInt(0) &&
    configVersion > BigInt(0) &&
    expiresAt >= issuedAt
  );
}

export function selectFifthMoveFunction(input: {
  route: ProofRoute;
  hasUsableProof: boolean;
  fifthMoveConfigEnabled: boolean;
}): { functionName: string; usesProof: boolean; clockObjectId: string | null } {
  if (input.route === "pvp-direct") {
    return input.hasUsableProof
      ? {
          functionName: "join_queue_v3_with_fifth_move",
          usesProof: true,
          clockObjectId: FIFTH_MOVE_CLOCK_OBJECT_ID,
        }
      : { functionName: "join_queue_v3", usesProof: false, clockObjectId: null };
  }

  if (input.route === "pvp-kiosk") {
    return input.hasUsableProof
      ? {
          functionName: "join_queue_v3_with_fifth_move_from_kiosk",
          usesProof: true,
          clockObjectId: FIFTH_MOVE_CLOCK_OBJECT_ID,
        }
      : { functionName: "join_queue_v3_from_kiosk", usesProof: false, clockObjectId: null };
  }

  if (input.route === "ranked-bot-direct") {
    return input.hasUsableProof
      ? {
          functionName: "create_ranked_bot_battle_v2_with_fifth_move",
          usesProof: true,
          clockObjectId: FIFTH_MOVE_CLOCK_OBJECT_ID,
        }
      : {
          functionName: input.fifthMoveConfigEnabled
            ? "create_ranked_bot_battle_v2_standard"
            : "create_bot_battle",
          usesProof: false,
          clockObjectId: null,
        };
  }

  return input.hasUsableProof
    ? {
        functionName: "create_ranked_bot_battle_v2_with_fifth_move_from_kiosk",
        usesProof: true,
        clockObjectId: FIFTH_MOVE_CLOCK_OBJECT_ID,
      }
    : {
        functionName: input.fifthMoveConfigEnabled
          ? "create_ranked_bot_battle_v2_standard_from_kiosk"
          : "create_bot_battle_from_kiosk",
        usesProof: false,
        clockObjectId: null,
      };
}
