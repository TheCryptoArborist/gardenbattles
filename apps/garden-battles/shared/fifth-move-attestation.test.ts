import assert from "node:assert/strict";
import test from "node:test";
import { toHex } from "@mysten/sui/utils";
import {
  buildFifthMoveAttestationPayload,
  serializeFifthMoveAttestationPayload,
} from "./fifth-move-attestation";

test("serializes the canonical Fifth Move attestation payload", () => {
  const payload = buildFifthMoveAttestationPayload({
    fifthMoveConfigId: "0xd726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3",
    wallet: "0x000000000000000000000000000000000000000000000000000000000000000b",
    qualified: true,
    verifiedUnderlyingTreeRaw: "1000000000000",
    sourceBitmap: 5,
    configVersion: 2,
    issuedAtMs: 1_000_000,
    expiresAtMs: 1_120_000,
  });

  assert.equal(
    toHex(serializeFifthMoveAttestationPayload(payload)),
    "011c47415244454e5f424154544c45535f46494654485f4d4f56455f56310b7375693a6d61696e6e6574d726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3000000000000000000000000000000000000000000000000000000000000000b010010a5d4e80000000010a5d4e800000005020000000000000040420f00000000000017110000000000",
  );
});
