import { Buffer } from "node:buffer";
import { pathToFileURL } from "node:url";

const ED25519_SCHEME_FLAG = 0;
const RAW_PUBLIC_KEY_LENGTH = 32;
const SUI_PUBLIC_KEY_LENGTH = 33;

type DecodeResult = {
  rawPublicKey: Uint8Array;
  inputEncoding: "base64" | "hex";
  strippedSuiSchemeFlag: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  npm.cmd exec -- tsx scripts/fifth-move-public-key-vector.ts --public-key-base64 <BASE64>",
    "  npm.cmd exec -- tsx scripts/fifth-move-public-key-vector.ts --raw-public-key-hex <HEX>",
    "",
    "Notes:",
    "  - Accepts public key material only. Do not paste private keys here.",
    "  - Sui keytool public_key_base64 is commonly 33 bytes: scheme flag + 32-byte key.",
    "  - FifthMoveConfig expects the raw 32-byte Ed25519 public key as vector<u8>.",
  ].join("\n");
}

function parseHex(value: string): Uint8Array {
  const normalized = value.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("invalid_hex_public_key");
  }
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

function parseBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (!normalized) throw new Error("invalid_base64_public_key");
  const bytes = Uint8Array.from(Buffer.from(normalized, "base64"));
  if (bytes.length === 0) throw new Error("invalid_base64_public_key");
  return bytes;
}

export function normalizeEd25519PublicKey(input: {
  publicKeyBase64?: string;
  rawPublicKeyHex?: string;
}): DecodeResult {
  const hasBase64 = Boolean(input.publicKeyBase64);
  const hasHex = Boolean(input.rawPublicKeyHex);
  if (hasBase64 === hasHex) {
    throw new Error("provide_exactly_one_public_key_input");
  }

  const inputEncoding = hasBase64 ? "base64" : "hex";
  const bytes = hasBase64
    ? parseBase64(input.publicKeyBase64 ?? "")
    : parseHex(input.rawPublicKeyHex ?? "");

  if (bytes.length === RAW_PUBLIC_KEY_LENGTH) {
    return { rawPublicKey: bytes, inputEncoding, strippedSuiSchemeFlag: false };
  }

  if (bytes.length === SUI_PUBLIC_KEY_LENGTH) {
    if (bytes[0] !== ED25519_SCHEME_FLAG) {
      throw new Error("public_key_scheme_is_not_ed25519");
    }
    return {
      rawPublicKey: bytes.slice(1),
      inputEncoding,
      strippedSuiSchemeFlag: true,
    };
  }

  throw new Error(`unexpected_public_key_length:${bytes.length}`);
}

export function formatPublicKeyVector(bytes: Uint8Array): string {
  return `[${Array.from(bytes).join(",")}]`;
}

export function formatPublicKeyHex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function parseCliArgs(argv: string[]): { publicKeyBase64?: string; rawPublicKeyHex?: string } {
  const result: { publicKeyBase64?: string; rawPublicKeyHex?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--public-key-base64") {
      result.publicKeyBase64 = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--raw-public-key-hex") {
      result.rawPublicKeyHex = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`unknown_argument:${arg}`);
  }
  return result;
}

function main(): void {
  try {
    const decoded = normalizeEd25519PublicKey(parseCliArgs(process.argv.slice(2)));
    console.log(`inputEncoding=${decoded.inputEncoding}`);
    console.log(`strippedSuiSchemeFlag=${decoded.strippedSuiSchemeFlag}`);
    console.log(`rawPublicKeyHex=${formatPublicKeyHex(decoded.rawPublicKey)}`);
    console.log(`suiCliVector=${formatPublicKeyVector(decoded.rawPublicKey)}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error("");
    console.error(usage());
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
