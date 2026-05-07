// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: "mainnet",
  CHAIN: "sui:mainnet",
  RPC_URL: "https://fullnode.mainnet.sui.io:443",
  WS_URL: "wss://fullnode.mainnet.sui.io:443",
  PACKAGE_ID:
    "0x25d3dd5bfb4bf4afbc1f1da0ec7ad90498e41f74e094abdd6df23047d64432e9",
  MODULE: "battle",
  CONFIG_ID:
    "0xe98215c022612b4a58d788a36db183556b90d7270e07d43389b23baba93fcb4b",
  MATCHMAKING_QUEUE_ID:
    "0xca973a3c3f1cacb205be68b0602376a2630c0c73ddc1000cb60a7b3277d43ebe",
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
  ENTRY_FEE: 3_000_000_000, // 3 SUI
  RANDOM_OBJECT_CANDIDATES: ["0x8", "0x6"],
  ADMIN_ADDRESSES: [
    "0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36", // Contract deployer
  ],
} as const;

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
  // ── Attack moves (drain opponent's growth) ──────────────────────────────────
  1: { type: "attack", emoji: "💣", effect: "Drains -10 from opponent's Growth" },
  2: { type: "attack", emoji: "🗡️", effect: "Drains -8 from opponent's Growth" },
  3: { type: "attack", emoji: "🌵", effect: "Drains -12 from opponent's Growth" },
  4: { type: "attack", emoji: "🔱", effect: "Drains -7 from opponent's Growth" },
  5: { type: "attack", emoji: "⚡", effect: "Drains -9 from opponent's Growth" },
  6: { type: "attack", emoji: "🪨", effect: "Drains -6 from opponent's Growth" },
  7: { type: "attack", emoji: "🥊", effect: "Drains -11 from opponent's Growth" },
  // ── Hybrid moves (both attack and self-effect) ───────────────────────────────
  8: { type: "hybrid", emoji: "🛡️", effect: "Drains -5 from opponent + blocks next hit" },
  9: { type: "hybrid", emoji: "🩸", effect: "Drains -8 from opponent + grows your tree +4" },
  10: { type: "attack", emoji: "☠️", effect: "Poisons opponent: -5 Growth for 2 turns" },
  11: { type: "attack", emoji: "💀", effect: "Drains -15 from opponent (80% hit chance)" },
  12: { type: "attack", emoji: "🌫️", effect: "Drains -10 OR gives opponent a block (50/50)" },
  13: { type: "attack", emoji: "🍄", effect: "Drains -7 from opponent + extra -3 next turn" },
  // ── Growth moves (boost your own Growth) ────────────────────────────────────
  20: { type: "growth", emoji: "🌱", effect: "Grows YOUR tree +10" },
  21: { type: "growth", emoji: "☀️", effect: "Grows YOUR tree +8 to +12" },
  22: { type: "growth", emoji: "🌧️", effect: "Grows YOUR tree +15" },
  23: { type: "growth", emoji: "🍄", effect: "Grows YOUR tree +10, 20% chance for +5 bonus" },
  24: { type: "growth", emoji: "💨", effect: "Grows YOUR tree +12 to +18" },
  25: { type: "growth", emoji: "⚗️", effect: "Grows YOUR tree +20 (90% success rate)" },
  26: { type: "growth", emoji: "🌿", effect: "Grows YOUR tree +15 to +20" },
  27: { type: "hybrid", emoji: "🪵", effect: "Grows YOUR tree +10 + blocks next hit" },
  28: { type: "growth", emoji: "🌊", effect: "Grows YOUR tree +12" },
  29: { type: "hybrid", emoji: "☁️", effect: "Grows YOUR tree +8, 50% chance to block" },
  30: { type: "growth", emoji: "🌳", effect: "Grows YOUR tree +10 to +15" },
};

export function getBattleUpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::BattleUpdate`;
}
