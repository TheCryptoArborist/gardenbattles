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
    "0x1624a78e4ea737c12f95515e40d53f0ffac2f499639f19359d0611893aa644e9::collection::NFT",
  COLLECTION_PACKAGE_ID:
    "0x1624a78e4ea737c12f95515e40d53f0ffac2f499639f19359d0611893aa644e9",
  COLLECTION_MODULE: "collection",
  COLLECTION_MINT_CONFIG_ID: "0x4bd80e69f4bd787f93ab5e35aa8027e6d1efa8227dc1d2fd02b2d481f48996c8",
  COLLECTION_POOL_ID: "0xaed1160b32fb9410aa13469eea8c6cd8a67b8e1d139dc04b5396d8eb551e0716",
  COLLECTION_MINT_PRICE_MIST: 25_000_000_000,
  COLLECTION_IMAGE_BASE_URI:
    "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeibcs6wmqckyw2xmsl3u2m6si2uww5orz4l6ewbmio5scmllvux7le",
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
