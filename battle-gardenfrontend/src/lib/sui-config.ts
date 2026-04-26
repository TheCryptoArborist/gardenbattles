// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: "testnet",
  CHAIN: "sui:testnet",
  RPC_URL: "https://fullnode.testnet.sui.io:443",
  WS_URL: "wss://fullnode.testnet.sui.io:443",
  PACKAGE_ID:
    "0x961de326a402dead5ca66839bfe610a93f0bba51d3e7037562fe482344906484",
  MODULE: "battle",
  CONFIG_ID:
    "0x3af58ed4d73c2ca8c0f6e9a59931ff86f8d46d6b6e8c8722e55ad46bed0d61a6",
  MATCHMAKING_QUEUE_ID:
    "0x5de6ce9f3dd2f3636b4b4f48d8c75fa16601e7bd3e8e499c73d63dd1ff596316",
  SAPLING_STRUCT:
    "0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft",
  COLLECTION_PACKAGE_ID:
    "0x119a5ae3f0278c28a14fac813e10b980382de37eeae3a0b534bf8e04443d5208",
  COLLECTION_MODULE: "collection",
  COLLECTION_MINT_CONFIG_ID: "0xREPLACE_WITH_COLLECTION_MINT_CONFIG_ID",
  COLLECTION_MINT_PRICE_MIST: 25_000_000_000,
  COLLECTION_IMAGE_BASE_URI:
    "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda",
  COLLECTION_NAME_PREFIX: "Tree Nft #",
  COLLECTION_DESCRIPTION: "TreeNft Collection",
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
