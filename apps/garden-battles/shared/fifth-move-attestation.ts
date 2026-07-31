import { bcs } from "@mysten/sui/bcs";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

export const FIFTH_MOVE_ATTESTATION_VERSION = 1;
export const FIFTH_MOVE_ATTESTATION_DOMAIN = "GARDEN_BATTLES_FIFTH_MOVE_V1";
export const FIFTH_MOVE_ATTESTATION_NETWORK = "sui:mainnet";
export const FIFTH_MOVE_THRESHOLD_RAW = "1000000000000";

export const FIFTH_MOVE_SOURCE_BITS = {
  suidexV2Direct: 1 << 0,
  suidexV2Farm: 1 << 1,
  suidexV3: 1 << 2,
  moonbagsStaking: 1 << 3,
} as const;

export interface FifthMoveAttestationPayload {
  version: number;
  domain: number[];
  network: number[];
  fifth_move_config_id: string;
  wallet: string;
  qualified: boolean;
  verified_underlying_tree_raw: string;
  threshold_raw: string;
  source_bitmap: number;
  config_version: string;
  issued_at_ms: string;
  expires_at_ms: string;
}

const textEncoder = new TextEncoder();

export const FifthMoveAttestationPayloadBcs = bcs.struct(
  "FifthMoveAttestationPayload",
  {
    version: bcs.u8(),
    domain: bcs.vector(bcs.u8()),
    network: bcs.vector(bcs.u8()),
    fifth_move_config_id: bcs.Address,
    wallet: bcs.Address,
    qualified: bcs.bool(),
    verified_underlying_tree_raw: bcs.u64(),
    threshold_raw: bcs.u64(),
    source_bitmap: bcs.u8(),
    config_version: bcs.u64(),
    issued_at_ms: bcs.u64(),
    expires_at_ms: bcs.u64(),
  },
);

export function asciiBytes(value: string): number[] {
  return Array.from(textEncoder.encode(value));
}

export function buildFifthMoveAttestationPayload(input: {
  fifthMoveConfigId: string;
  wallet: string;
  qualified: boolean;
  verifiedUnderlyingTreeRaw: string;
  thresholdRaw?: string;
  sourceBitmap: number;
  configVersion: string | number | bigint;
  issuedAtMs: string | number | bigint;
  expiresAtMs: string | number | bigint;
}): FifthMoveAttestationPayload {
  return {
    version: FIFTH_MOVE_ATTESTATION_VERSION,
    domain: asciiBytes(FIFTH_MOVE_ATTESTATION_DOMAIN),
    network: asciiBytes(FIFTH_MOVE_ATTESTATION_NETWORK),
    fifth_move_config_id: input.fifthMoveConfigId.toLowerCase(),
    wallet: input.wallet.toLowerCase(),
    qualified: input.qualified,
    verified_underlying_tree_raw: input.verifiedUnderlyingTreeRaw,
    threshold_raw: input.thresholdRaw ?? FIFTH_MOVE_THRESHOLD_RAW,
    source_bitmap: input.sourceBitmap,
    config_version: String(input.configVersion),
    issued_at_ms: String(input.issuedAtMs),
    expires_at_ms: String(input.expiresAtMs),
  };
}

export function serializeFifthMoveAttestationPayload(
  payload: FifthMoveAttestationPayload,
): Uint8Array {
  return FifthMoveAttestationPayloadBcs.serialize(payload).toBytes();
}

export function encodeFifthMoveAttestationPayload(payload: FifthMoveAttestationPayload): string {
  return toBase64(serializeFifthMoveAttestationPayload(payload));
}

export function decodeBase64Bytes(value: string): number[] {
  return Array.from(fromBase64(value));
}
