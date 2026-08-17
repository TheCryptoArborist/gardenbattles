import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPublicKeyHex,
  formatPublicKeyVector,
  normalizeEd25519PublicKey,
} from "./fifth-move-public-key-vector.ts";

const RAW_HEX = "39132a7d1d870dede13f6207f428d91acb0371dd8badf19e9787df044ec90a39";
const SUI_KEYTOOL_PUBLIC_KEY_BASE64 = "ADkTKn0dhw3t4T9iB/Qo2RrLA3Hdi63xnpeH3wROyQo5";

test("normalizes Sui keytool Ed25519 public_key_base64 to raw 32-byte key", () => {
  const decoded = normalizeEd25519PublicKey({
    publicKeyBase64: SUI_KEYTOOL_PUBLIC_KEY_BASE64,
  });

  assert.equal(decoded.inputEncoding, "base64");
  assert.equal(decoded.strippedSuiSchemeFlag, true);
  assert.equal(decoded.rawPublicKey.length, 32);
  assert.equal(formatPublicKeyHex(decoded.rawPublicKey), `0x${RAW_HEX}`);
});

test("accepts an already raw 32-byte public key hex value", () => {
  const decoded = normalizeEd25519PublicKey({ rawPublicKeyHex: `0x${RAW_HEX}` });

  assert.equal(decoded.inputEncoding, "hex");
  assert.equal(decoded.strippedSuiSchemeFlag, false);
  assert.equal(decoded.rawPublicKey.length, 32);
  assert.equal(formatPublicKeyVector(decoded.rawPublicKey).startsWith("[57,19,42"), true);
});

test("rejects non-Ed25519 Sui public keys with a different scheme flag", () => {
  const wrongScheme = Buffer.from(`01${RAW_HEX}`, "hex").toString("base64");

  assert.throws(
    () => normalizeEd25519PublicKey({ publicKeyBase64: wrongScheme }),
    /public_key_scheme_is_not_ed25519/,
  );
});

test("rejects ambiguous, missing, or malformed public key inputs", () => {
  assert.throws(() => normalizeEd25519PublicKey({}), /provide_exactly_one_public_key_input/);
  assert.throws(
    () => normalizeEd25519PublicKey({
      publicKeyBase64: SUI_KEYTOOL_PUBLIC_KEY_BASE64,
      rawPublicKeyHex: RAW_HEX,
    }),
    /provide_exactly_one_public_key_input/,
  );
  assert.throws(() => normalizeEd25519PublicKey({ rawPublicKeyHex: "abc" }), /invalid_hex_public_key/);
  assert.throws(
    () => normalizeEd25519PublicKey({ rawPublicKeyHex: "0x1234" }),
    /unexpected_public_key_length:2/,
  );
});
