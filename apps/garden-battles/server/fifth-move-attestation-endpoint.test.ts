import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import {
  createFifthMoveAttestationHandler,
  validateLiveFifthMoveConfigFields,
  type FifthMoveAttestationRouteOptions,
} from "./routes";
import {
  decodeBase64Bytes,
  FIFTH_MOVE_SOURCE_BITS,
  serializeFifthMoveAttestationPayload,
} from "../shared/fifth-move-attestation";
import { TREE_COIN_TYPE, type FifthMoveEligibilityResponse } from "../shared/tree-power-eligibility";

const WALLET = "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";
const CONFIG_ID = "0xd726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3";

function qualifiedEligibility(overrides: Partial<FifthMoveEligibilityResponse> = {}): FifthMoveEligibilityResponse {
  return {
    status: "qualified",
    wallet: WALLET,
    thresholdRaw: "1000000000000",
    totalVerifiedUnderlyingTreeRaw: "2500000000000",
    verifiedUnderlyingTreeRaw: "2500000000000",
    remainingTreeRaw: "0",
    sources: [
      {
        source: "suidex-v3",
        status: "qualified-data",
        underlyingTreeRaw: "2500000000000",
        reason: "localnet injected fixture",
      },
    ],
    checkedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function nonQualifiedEligibility(status: FifthMoveEligibilityResponse["status"]): FifthMoveEligibilityResponse {
  return {
    ...qualifiedEligibility({
      status,
      totalVerifiedUnderlyingTreeRaw: "0",
      verifiedUnderlyingTreeRaw: "0",
      remainingTreeRaw: "1000000000000",
      sources: [
        {
          source: "suidex-v3",
          status: status === "not-qualified" ? "verified-zero" : "unavailable",
          reason: "localnet injected fixture",
        },
      ],
    }),
  };
}

async function withEndpoint(
  options: FifthMoveAttestationRouteOptions,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.post("/api/tree-power/fifth-move-attestation", createFifthMoveAttestationHandler(options));
  const server: Server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function postAttestation(baseUrl: string, wallet = WALLET): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/api/tree-power/fifth-move-attestation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  return { status: response.status, body: await response.json() };
}

test("actual Fifth Move attestation HTTP endpoint returns a raw Ed25519 BCS proof", async () => {
  const signer = Ed25519Keypair.generate();
  let readConfigCalls = 0;

  await withEndpoint(
    {
      getSigner: () => signer,
      getEligibility: async () => qualifiedEligibility(),
      readConfig: async (serverSignerPublicKey) => {
        readConfigCalls += 1;
        assert.deepEqual(Array.from(serverSignerPublicKey), Array.from(signer.getPublicKey().toRawBytes()));
        return {
          id: CONFIG_ID,
          enabled: true,
          utilityCoin: TREE_COIN_TYPE,
          minUnderlyingTreeRaw: "1000000000000",
          signerPublicKey: signer.getPublicKey().toRawBytes(),
          configVersion: "7",
          maxAttestationAgeMs: "120000",
        };
      },
      checkRateLimit: () => true,
      nowMs: () => 1_000_000,
      ttlMs: 300_000,
      keyId: "localnet-test",
    },
    async (baseUrl) => {
      const { status, body } = await postAttestation(baseUrl);
      assert.equal(status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.attestation.fifthMoveConfigId, CONFIG_ID);
      assert.equal(body.attestation.keyId, "localnet-test");
      assert.equal(body.attestation.payload.wallet, WALLET);
      assert.equal(body.attestation.payload.fifth_move_config_id, CONFIG_ID);
      assert.equal(body.attestation.payload.threshold_raw, "1000000000000");
      assert.equal(body.attestation.payload.config_version, "7");
      assert.equal(body.attestation.payload.source_bitmap, FIFTH_MOVE_SOURCE_BITS.suidexV3);
      assert.equal(body.attestation.payload.issued_at_ms, "1000000");
      assert.equal(body.attestation.payload.expires_at_ms, "1120000");

      const payloadBytes = serializeFifthMoveAttestationPayload(body.attestation.payload);
      assert.deepEqual(decodeBase64Bytes(body.attestation.payloadBytes), Array.from(payloadBytes));
      const signature = fromBase64(body.attestation.signature);
      const publicKey = fromBase64(body.attestation.signerPublicKey);
      assert.equal(signature.length, 64);
      assert.equal(publicKey.length, 32);
      assert.equal(await new Ed25519PublicKey(publicKey).verify(payloadBytes, signature), true);
    },
  );

  assert.equal(readConfigCalls, 1);
});

test("attestation endpoint returns no proof for nonqualified or incomplete wallets", async () => {
  const signer = Ed25519Keypair.generate();
  for (const status of ["not-qualified", "verification-incomplete", "unavailable"] as const) {
    await withEndpoint(
      {
        getSigner: () => signer,
        getEligibility: async () => nonQualifiedEligibility(status),
        readConfig: async () => {
          throw new Error("config must not be read for nonqualified wallets");
        },
        checkRateLimit: () => true,
      },
      async (baseUrl) => {
        const result = await postAttestation(baseUrl);
        assert.equal(result.status, 200);
        assert.equal(result.body.ok, true);
        assert.equal(result.body.attestation, null);
        assert.equal(result.body.eligibility.status, status);
      },
    );
  }
});

test("attestation endpoint refuses to sign when config or signer is unavailable", async () => {
  const signer = Ed25519Keypair.generate();

  await withEndpoint(
    {
      getSigner: () => null,
      getEligibility: async () => qualifiedEligibility(),
      checkRateLimit: () => true,
    },
    async (baseUrl) => {
      const result = await postAttestation(baseUrl);
      assert.equal(result.status, 503);
      assert.equal(result.body.reason, "fifth_move_signer_unconfigured");
      assert.equal(result.body.attestation, null);
    },
  );

  await withEndpoint(
    {
      getSigner: () => signer,
      getEligibility: async () => qualifiedEligibility(),
      readConfig: async () => {
        throw new Error("fifth_move_config_disabled");
      },
      checkRateLimit: () => true,
    },
    async (baseUrl) => {
      const result = await postAttestation(baseUrl);
      assert.equal(result.status, 503);
      assert.equal(result.body.reason, "fifth_move_config_disabled");
    },
  );
});

test("attestation endpoint validates disabled config signer equality before returning disabled", async () => {
  const signer = Ed25519Keypair.generate();

  await withEndpoint(
    {
      getSigner: () => signer,
      getEligibility: async () => qualifiedEligibility(),
      readConfig: async (serverSignerPublicKey) => validateLiveFifthMoveConfigFields(
        {
          id: CONFIG_ID,
          enabled: false,
          utilityCoin: TREE_COIN_TYPE,
          minUnderlyingTreeRaw: "1000000000000",
          signerPublicKey: signer.getPublicKey().toRawBytes(),
          configVersion: "1",
          maxAttestationAgeMs: "180000",
        },
        serverSignerPublicKey,
      ),
      checkRateLimit: () => true,
    },
    async (baseUrl) => {
      const result = await postAttestation(baseUrl);
      assert.equal(result.status, 503);
      assert.equal(result.body.reason, "fifth_move_config_disabled");
      assert.equal(result.body.attestation, undefined);
    },
  );
});

test("attestation endpoint reports disabled config signer mismatch before disabled", async () => {
  const serverSigner = Ed25519Keypair.generate();
  const onChainSigner = Ed25519Keypair.generate();

  await withEndpoint(
    {
      getSigner: () => serverSigner,
      getEligibility: async () => qualifiedEligibility(),
      readConfig: async (serverSignerPublicKey) => validateLiveFifthMoveConfigFields(
        {
          id: CONFIG_ID,
          enabled: false,
          utilityCoin: TREE_COIN_TYPE,
          minUnderlyingTreeRaw: "1000000000000",
          signerPublicKey: onChainSigner.getPublicKey().toRawBytes(),
          configVersion: "1",
          maxAttestationAgeMs: "180000",
        },
        serverSignerPublicKey,
      ),
      checkRateLimit: () => true,
    },
    async (baseUrl) => {
      const result = await postAttestation(baseUrl);
      assert.equal(result.status, 503);
      assert.equal(result.body.reason, "fifth_move_signer_mismatch");
      assert.equal(result.body.attestation, undefined);
    },
  );
});

test("attestation endpoint validates wallet input and rate limits before signing", async () => {
  const signer = Ed25519Keypair.generate();

  await withEndpoint(
    {
      getSigner: () => signer,
      getEligibility: async () => qualifiedEligibility(),
      checkRateLimit: () => false,
    },
    async (baseUrl) => {
      const invalid = await postAttestation(baseUrl, "0xnot-an-address");
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.reason, "invalid_sui_address");

      const limited = await postAttestation(baseUrl);
      assert.equal(limited.status, 429);
      assert.equal(limited.body.reason, "rate_limited");
    },
  );
});
