export const GARDEN_BATTLES_MOBILE_URL = "https://nftree.net/battle/";

export const SLUSH_WALLET_CONFIG = {
  name: "Garden Battles",
} as const;

export const PREFERRED_MOBILE_WALLETS = [
  "Slush",
  "Slush — A Sui wallet",
  "Nightly",
  "Phantom",
] as const;

export function buildNightlyBattleLink(
  targetUrl = GARDEN_BATTLES_MOBILE_URL,
): string {
  const params = new URLSearchParams({
    network: "sui",
    cluster: "mainnet",
    url: targetUrl,
  });
  return `https://nightly.app/v1?${params.toString()}`;
}

export function buildPhantomBattleLink(
  targetUrl = GARDEN_BATTLES_MOBILE_URL,
): string {
  const ref = new URL(targetUrl).origin;
  return `https://phantom.app/ul/browse/${encodeURIComponent(targetUrl)}?ref=${encodeURIComponent(ref)}`;
}
