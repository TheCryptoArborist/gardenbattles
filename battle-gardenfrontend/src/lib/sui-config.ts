// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: "mainnet",
  CHAIN: "sui:mainnet",
  RPC_URL: "https://fullnode.mainnet.sui.io:443",
  WS_URL: "wss://fullnode.mainnet.sui.io:443",
  PACKAGE_ID:
    "0x5d20351dc2275d127b4cbd3f5fb05286dc8a7bf347f3a9bdfee073e66ea08fa0",
  MODULE: "battle",
  CONFIG_ID:
    "0xbe3fe19aea25beb8d71c1837bd9750af44cc36115d7683abe5229a75604e4ade",
  MATCHMAKING_QUEUE_ID:
    "0xcdd3efb7736cd24aaa640f10d6e3cd11c7a9b2f1db011f4519a2dcb0ebe6a646",
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
  ENTRY_FEE: 0, // 0 SUI (set via Admin Panel for testing)
  RANDOM_OBJECT_CANDIDATES: ["0x8", "0x6"],
  ADMIN_ADDRESSES: [
    "0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36", // Contract deployer
  ],
} as const;

export const MOVE_LABELS: Record<number, string> = {
  1: "Thorn Spike Bomb (-10)",
  2: "Razor Leaf Sword (-8)",
  3: "Tumbleweed Mace (-12)",
  4: "Shovel Spear (-7)",
  5: "Thorned Whip (-9)",
  6: "Acorn Slingshot (-6)",
  7: "Stone Nunchuck (-11)",
  8: "Cactus Shield (-5/Block)",
  9: "Life Absorb (-8/+4)",
  10: "Poison (-5x2)",
  11: "Wither Touch (-15/20% Miss)",
  12: "Pollen Cloud (-10/50% Block)",
  13: "Fungal Rot (-7/next -3)",
  20: "Roots Up (+10)",
  21: "Sun Beam (+8-12)",
  22: "Rain Storm (+15)",
  23: "White Mold (+10/20% +5)",
  24: "Greenhouse Gas (+12-18)",
  25: "Potassium Power Up (+20/10% Fail)",
  26: "Photosynthetic Surge (+15-20)",
  27: "Barkskin Armor (+10/Block)",
  28: "Sap Overflow (+12)",
  29: "Cloud Cover (+8/50% Block)",
  30: "Shadow Canopy (+10-15)",
};

export function getBattleUpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::BattleUpdate`;
}
