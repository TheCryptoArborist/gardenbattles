export interface NftData {
  nftId: string;
  nftType: string;
  location: "wallet" | "kiosk";
  kioskId?: string;
  kioskCapId?: string;
  imageUrl?: string;
}

type NftreeAccessClient = {
  getOwnedObjects: (args: any) => Promise<{
    data: any[];
    hasNextPage?: boolean;
    nextCursor?: string | null;
  }>;
  getDynamicFields: (args: { parentId: string }) => Promise<{ data: any[] }>;
  getObject: (args: {
    id: string;
    options?: Record<string, unknown>;
  }) => Promise<{ data?: any }>;
};

export function readAllowedNftTypesFromStorage(
  storage: Storage | null | undefined,
  fallbackType: string,
): string[] {
  if (!storage) return [fallbackType];

  try {
    const stored = storage.getItem("allowed_nft_collections");
    if (!stored) return [fallbackType];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [fallbackType];

    const storedTypes = parsed
      .map((collection: any) => collection?.type)
      .filter((type: unknown): type is string => typeof type === "string");

    return Array.from(new Set([fallbackType, ...storedTypes]));
  } catch (err) {
    console.warn("[nftree-access] ignoring malformed collection cache", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [fallbackType];
  }
}

export function mergeAllowedNftTypes(
  currentTypes: string[],
  onChainTypes: string[],
): string[] {
  return Array.from(new Set([...currentTypes, ...onChainTypes]));
}

function extractImageUrl(obj: any): string {
  const displayUrl = obj?.data?.display?.data?.image_url;
  const contentUrlField = obj?.data?.content?.fields?.image_url;
  const contentUrl =
    typeof contentUrlField === "string"
      ? contentUrlField
      : contentUrlField?.fields?.url || contentUrlField?.url || "";

  return displayUrl || contentUrl || "";
}

function nftFromObject(
  obj: any,
  allowedTypes: string[],
  location: "wallet" | "kiosk",
  kiosk?: { kioskId: string; kioskCapId: string },
): NftData | null {
  const type = obj?.data?.type;
  const id = obj?.data?.objectId;
  if (!type || !id || !allowedTypes.includes(type)) return null;

  return {
    nftId: id,
    nftType: type,
    location,
    ...(kiosk
      ? { kioskId: kiosk.kioskId, kioskCapId: kiosk.kioskCapId }
      : {}),
    imageUrl: extractImageUrl(obj),
  };
}

export async function findDirectWalletNftByTypeFilter(
  suiClient: NftreeAccessClient,
  owner: string,
  allowedTypes: string[],
): Promise<NftData | null> {
  for (const type of allowedTypes) {
    try {
      const res = await suiClient.getOwnedObjects({
        owner,
        filter: { StructType: type },
        options: { showType: true, showContent: true, showDisplay: true },
        limit: 50,
      });

      for (const obj of res.data) {
        const nft = nftFromObject(obj, allowedTypes, "wallet");
        if (nft) return nft;
      }
    } catch (err) {
      console.warn("[nftree-access] filtered wallet NFT lookup failed", {
        type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return null;
}

export async function scanWalletAndKiosksForNft(
  suiClient: NftreeAccessClient,
  owner: string,
  allowedTypes: string[],
): Promise<NftData | null> {
  const kiosks = new Map<string, string>();
  let cursor: string | null = null;

  do {
    const res = await suiClient.getOwnedObjects({
      owner,
      options: { showType: true, showContent: true, showDisplay: true },
      cursor: cursor || undefined,
      limit: 50,
    });

    for (const obj of res.data) {
      const type = obj?.data?.type;
      if (!type) continue;

      if (type.includes("::kiosk::KioskOwnerCap")) {
        const capId = obj?.data?.objectId;
        const kioskId =
          obj?.data?.content?.fields?.for?.fields?.kiosk_id ||
          obj?.data?.content?.fields?.kiosk_id ||
          obj?.data?.content?.fields?.for;
        if (kioskId && capId) kiosks.set(kioskId, capId);
      }

      const nft = nftFromObject(obj, allowedTypes, "wallet");
      if (nft) return nft;
    }

    cursor = res.hasNextPage ? (res.nextCursor ?? null) : null;
  } while (cursor);

  for (const [kioskId, ownerCapId] of Array.from(kiosks.entries())) {
    try {
      const fields = await suiClient.getDynamicFields({ parentId: kioskId });
      for (const field of fields.data) {
        const fieldType = field?.name?.type ?? "";
        if (fieldType.includes("::Lock")) continue;

        const nftId = field?.name?.value?.id;
        if (!nftId) continue;

        const obj = await suiClient.getObject({
          id: nftId,
          options: { showType: true, showContent: true, showDisplay: true },
        });

        const nft = nftFromObject(obj, allowedTypes, "kiosk", {
          kioskId,
          kioskCapId: ownerCapId,
        });
        if (nft && fieldType.includes("::Item")) return nft;
      }
    } catch {
      // Skip kiosks that cannot be read and keep looking for another NFTree.
    }
  }

  return null;
}
