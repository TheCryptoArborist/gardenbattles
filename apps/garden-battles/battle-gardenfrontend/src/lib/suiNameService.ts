const SUINS_CACHE_PREFIX = "garden-battles:suins:v3:";
const suiNameCache = new Map<string, string>();
const SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";

export function readCachedSuiName(address: string): string | undefined {
  const normalizedAddress = address.toLowerCase();
  const memoryValue = suiNameCache.get(normalizedAddress);
  if (memoryValue) return memoryValue;

  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.sessionStorage.getItem(`${SUINS_CACHE_PREFIX}${normalizedAddress}`);
    if (!stored) return undefined;
    suiNameCache.set(normalizedAddress, stored);
    return stored;
  } catch {
    return undefined;
  }
}

function writeCachedSuiName(address: string, name: string | null) {
  if (!name) return;
  const normalizedAddress = address.toLowerCase();
  suiNameCache.set(normalizedAddress, name);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${SUINS_CACHE_PREFIX}${normalizedAddress}`, name);
  } catch {
    // sessionStorage can be unavailable in strict privacy contexts.
  }
}

export async function resolveSuiNames(addresses: string[]): Promise<Record<string, string | null>> {
  const resolved: Record<string, string | null> = {};
  for (let offset = 0; offset < addresses.length; offset += 25) {
    const batch = addresses.slice(offset, offset + 25);
    const variableDefinitions = batch.map((_, index) => `$address${index}: SuiAddress!`).join(", ");
    const selections = batch
      .map((_, index) => `address${index}: address(address: $address${index}) { defaultNameRecord { domain } }`)
      .join("\n");
    const variables = Object.fromEntries(batch.map((address, index) => [`address${index}`, address]));

    try {
      const response = await fetch(SUI_GRAPHQL_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: `query GardenBattlesSuiNames(${variableDefinitions}) { ${selections} }`, variables }),
      });
      if (!response.ok) throw new Error(`SuiNS request failed with ${response.status}`);
      const payload = await response.json();
      for (let index = 0; index < batch.length; index += 1) {
        const address = batch[index];
        const name = payload?.data?.[`address${index}`]?.defaultNameRecord?.domain || null;
        resolved[address] = name;
        writeCachedSuiName(address, name);
      }
    } catch {
      for (const address of batch) resolved[address] = null;
    }
  }
  return resolved;
}
