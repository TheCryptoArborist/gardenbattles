// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: "mainnet",
  CHAIN: "sui:mainnet",
  RPC_URL:
    ((import.meta as any).env?.VITE_SUI_RPC_URL as string | undefined) ||
    "https://fullnode.mainnet.sui.io:443",
  RPC_FALLBACK_URL:
    ((import.meta as any).env?.VITE_SUI_RPC_FALLBACK_URL as string | undefined) ||
    "",
  WS_URL: "wss://fullnode.mainnet.sui.io:443",
  PACKAGE_ID: "0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23",
  ORIGINAL_PACKAGE_ID:
    "0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b",
  BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID: "0x6cae4020693bcfcac9523ce8bc3d0bef7f830900e48b743d002b5d6b676e5142",
  MODULE: "battle",
  CONFIG_ID:
    "0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf",
  LEGACY_MATCHMAKING_QUEUE_ID:
    "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d",
  MATCHMAKING_QUEUE_ID:
    "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d",
  MATCHMAKING_QUEUE_50_ID:
    "0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960",
  MATCHMAKING_QUEUE_75_ID:
    "0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd",
  MATCHMAKING_QUEUE_V3_50_ID:
    ((import.meta as any).env?.VITE_MATCHMAKING_QUEUE_V3_50_ID as string | undefined) || "",
  MATCHMAKING_QUEUE_V3_75_ID:
    ((import.meta as any).env?.VITE_MATCHMAKING_QUEUE_V3_75_ID as string | undefined) || "",
  FIFTH_MOVE_CONFIG_ID:
    ((import.meta as any).env?.VITE_FIFTH_MOVE_CONFIG_ID as string | undefined) || "",
  BOT_ADDRESS:
    "0xbbe518c2a2025d2d95b9e5b6435911771f64d7d9fe037fbf2ec661981890d5b4",
  SAPLING_STRUCT:
    "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT",
  COLLECTION_PACKAGE_ID:
    "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705",
  COLLECTION_MODULE: "collection",
  COLLECTION_MINT_CONFIG_ID: "0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b",
  COLLECTION_POOL_ID: "0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a",
  COLLECTION_MINT_PRICE_MIST: 25_000_000_000,
  COLLECTION_IMAGE_BASE_URI:
    "https://gateway.pinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda",
  COLLECTION_NAME_PREFIX: "Tree NFT #",
  COLLECTION_DESCRIPTION: "Tree NFT Collection",
  ENTRY_FEE: 3_000_000_000, // Intended battle entry fee: 3 SUI.
  RANDOM_OBJECT_CANDIDATES: ["0x8", "0x6"],
  ADMIN_ADDRESSES: [
    "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", // Contract admin
  ],
} as const;

export type PvpBattleVersion = "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2";
export type PvpMatchTarget = 50 | 75 | 100;
export type PvpQueueType = "legacy" | "v2" | "v3";

export interface PvpMatchOption {
  targetGrowth: PvpMatchTarget;
  label: string;
  shortLabel: string;
  queueId: string;
  queueType: PvpQueueType;
}

export function getPvpMatchOption(targetGrowth: PvpMatchTarget): PvpMatchOption {
  if (targetGrowth === 50) {
    const v3QueueId = SUI_CONFIG.MATCHMAKING_QUEUE_V3_50_ID.trim();
    return {
      targetGrowth,
      label: "Quick Match",
      shortLabel: "50 Growth",
      queueId: v3QueueId || SUI_CONFIG.MATCHMAKING_QUEUE_50_ID,
      queueType: v3QueueId ? "v3" : "v2",
    };
  }

  if (targetGrowth === 75) {
    const v3QueueId = SUI_CONFIG.MATCHMAKING_QUEUE_V3_75_ID.trim();
    return {
      targetGrowth,
      label: "Standard Match",
      shortLabel: "75 Growth",
      queueId: v3QueueId || SUI_CONFIG.MATCHMAKING_QUEUE_75_ID,
      queueType: v3QueueId ? "v3" : "v2",
    };
  }

  return {
    targetGrowth: 100,
    label: "Legacy Match",
    shortLabel: "100 Growth",
    queueId: SUI_CONFIG.LEGACY_MATCHMAKING_QUEUE_ID,
    queueType: "legacy",
  };
}

export function getConfiguredPvpQueueOptions(): PvpMatchOption[] {
  return [
    getPvpMatchOption(100),
    getPvpMatchOption(50),
    getPvpMatchOption(75),
  ].filter((option) => option.queueId.trim().length > 0);
}

export function getPvpMatchDisplayLabel(targetGrowth: PvpMatchTarget): string {
  const option = getPvpMatchOption(targetGrowth);
  return `${option.label} - First to ${option.targetGrowth} Growth`;
}

// Short display label for buttons
export const MOVE_LABELS: Record<number, string> = {
  1: "Thorn Spike Bomb",
  2: "Razor Leaf Sword",
  3: "Tumbleweed Mace",
  4: "Shovel Spear",
  5: "Thorned Whip",
  6: "Acorn Slingshot",
  7: "Stone Nunchuck",
  8: "Cactus Shield",
  9: "Life Absorb",
  10: "Poison",
  11: "Wither Touch",
  12: "Pollen Cloud",
  13: "Fungal Rot",
  20: "Roots Up",
  21: "Sun Beam",
  22: "Rain Storm",
  23: "White Mold",
  24: "Greenhouse Gas",
  25: "Potassium Power Up",
  26: "Photosynthetic Surge",
  27: "Barkskin Armor",
  28: "Sap Overflow",
  29: "Cloud Cover",
  30: "Shadow Canopy",
};

export type MoveType = "attack" | "growth" | "hybrid";

export interface MoveMeta {
  type: MoveType;
  effect: string; // human-readable effect description
  emoji: string;
}

// Full metadata for tooltips and color-coding
export const MOVE_META: Record<number, MoveMeta> = {
  // Attack moves (drain opponent's growth)
  1: { type: "attack", emoji: "", effect: "Drains -10 from opponent's Growth" },
  2: { type: "attack", emoji: "", effect: "Drains -8 from opponent's Growth" },
  3: { type: "attack", emoji: "", effect: "Drains -12 from opponent's Growth" },
  4: { type: "attack", emoji: "", effect: "Drains -7 from opponent's Growth" },
  5: { type: "attack", emoji: "", effect: "Drains -9 from opponent's Growth" },
  6: { type: "attack", emoji: "", effect: "Drains -6 from opponent's Growth" },
  7: { type: "attack", emoji: "", effect: "Drains -11 from opponent's Growth" },
  // Hybrid moves (both attack and self-effect)
  8: { type: "hybrid", emoji: "", effect: "Drains -5 from opponent + blocks next hit" },
  9: { type: "hybrid", emoji: "", effect: "Drains -8 from opponent + grows your tree +4" },
  10: { type: "attack", emoji: "", effect: "Poisons opponent: -5 Growth for 2 turns" },
  11: { type: "attack", emoji: "", effect: "Drains -15 from opponent (80% hit chance)" },
  12: { type: "attack", emoji: "", effect: "Drains -10 OR gives opponent a block (50/50)" },
  13: { type: "attack", emoji: "", effect: "Drains -7 from opponent + extra -3 next turn" },
  // Growth moves (boost your own Growth)
  20: { type: "growth", emoji: "", effect: "Grows YOUR tree +10" },
  21: { type: "growth", emoji: "", effect: "Grows YOUR tree +8 to +12" },
  22: { type: "growth", emoji: "", effect: "Grows YOUR tree +15" },
  23: { type: "growth", emoji: "", effect: "Grows YOUR tree +10, 20% chance for +5 bonus" },
  24: { type: "growth", emoji: "", effect: "Grows YOUR tree +12 to +18" },
  25: { type: "growth", emoji: "", effect: "Grows YOUR tree +20 (90% success rate)" },
  26: { type: "growth", emoji: "", effect: "Grows YOUR tree +15 to +20" },
  27: { type: "hybrid", emoji: "", effect: "Grows YOUR tree +10 + blocks next hit" },
  28: { type: "growth", emoji: "", effect: "Grows YOUR tree +12" },
  29: { type: "hybrid", emoji: "", effect: "Grows YOUR tree +8, 50% chance to block" },
  30: { type: "growth", emoji: "", effect: "Grows YOUR tree +10 to +15" },
};

const SELF_GROWTH_MOVE_IDS = new Set([
  9, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
]);

export function moveGrowsSelf(moveId: number): boolean {
  return SELF_GROWTH_MOVE_IDS.has(moveId);
}

export function getBattleUpdateEvent() {
  return `${SUI_CONFIG.ORIGINAL_PACKAGE_ID}::${SUI_CONFIG.MODULE}::BattleUpdate`;
}

export function getPvpBattleV2UpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::PvpBattleV2Update`;
}

export function getPvpBattleV3UpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::PvpBattleV3Update`;
}

export function getRankedBotBattleV2UpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::RankedBotBattleV2Update`;
}

export function getBotMoveResolvedEvent() {
  return `${SUI_CONFIG.BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID}::${SUI_CONFIG.MODULE}::BotMoveResolved`;
}
