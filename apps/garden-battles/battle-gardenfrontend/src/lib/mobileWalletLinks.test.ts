import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNightlyBattleLink,
  buildPhantomBattleLink,
  GARDEN_BATTLES_MOBILE_URL,
  PREFERRED_MOBILE_WALLETS,
  SLUSH_WALLET_CONFIG,
} from "./mobileWalletLinks";

describe("mobile wallet launch configuration", () => {
  it("registers Slush web wallet and prioritizes all supported mobile wallets", () => {
    assert.equal(SLUSH_WALLET_CONFIG.name, "Garden Battles");
    assert.deepEqual(PREFERRED_MOBILE_WALLETS, [
      "Slush",
      "Slush — A Sui wallet",
      "Nightly",
      "Phantom",
    ]);
  });

  it("builds the official Nightly Sui mainnet in-app browser link", () => {
    const link = new URL(buildNightlyBattleLink());
    assert.equal(link.origin, "https://nightly.app");
    assert.equal(link.pathname, "/v1");
    assert.equal(link.searchParams.get("network"), "sui");
    assert.equal(link.searchParams.get("cluster"), "mainnet");
    assert.equal(link.searchParams.get("url"), GARDEN_BATTLES_MOBILE_URL);
  });

  it("builds the official Phantom in-app browser link", () => {
    const link = buildPhantomBattleLink();
    assert.equal(
      link,
      "https://phantom.app/ul/browse/https%3A%2F%2Fnftree.net%2Fbattle%2F?ref=https%3A%2F%2Fnftree.net",
    );
  });
});
