// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: "testnet",
  RPC_URL: "https://fullnode.testnet.sui.io:443",
  WS_URL: "wss://fullnode.testnet.sui.io:443",
  PACKAGE_ID:
    "0x7f9f3a5656d9efd93e1428ef40a3572cf8681178ff77ea6e2211dff848fcefb7",
  MODULE: "battle",
  CONFIG_ID:
    "0xb83ac841de44b1dadb69761821e844e6ed5298dff941a9b4e4814e637d8c836b",
  MATCHMAKING_QUEUE_ID:
    "0x849d13e4b156373e89fca05809ae3e8c482924f80e2381888232b781839dceee",
  SAPLING_STRUCT:
    "0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft",
  ENTRY_FEE: 0, // 0 SUI (set via Admin Panel for testing)
  RANDOM_OBJECT_CANDIDATES: ["0x8", "0x6"],
  ADMIN_ADDRESSES: [
    "0xd854a95802b834b5ea45d4ac5506751c67f4c61c4b11e00d0faa2d74b805bf19", // Contract deployer
    "0xd854a95802b834b5ea45d4ac5506751c67f4c61c4b11e00d0faa2d74b805bf19",
    "0x2d3449bfb428de861aa411d8709bb6b28a6553a91ec3be0b6b6aa983e7b21ec6", // Your wallet
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
