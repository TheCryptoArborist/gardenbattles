import assert from "node:assert/strict";
import test from "node:test";
import { readCachedSuiName, resolveSuiNames } from "./suiNameService";

test("resolves and caches default SuiNS names for leaderboard wallets", async () => {
  const originalFetch = globalThis.fetch;
  const walletA = `0x${"1".repeat(64)}`;
  const walletB = `0x${"2".repeat(64)}`;

  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.variables.address0, walletA);
    assert.equal(request.variables.address1, walletB);
    return new Response(JSON.stringify({
      data: {
        address0: { defaultNameRecord: { domain: "arborist.sui" } },
        address1: { defaultNameRecord: null },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    assert.deepEqual(await resolveSuiNames([walletA, walletB]), {
      [walletA]: "arborist.sui",
      [walletB]: null,
    });
    assert.equal(readCachedSuiName(walletA), "arborist.sui");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
