// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: 'mainnet',
  RPC_URL: 'https://fullnode.mainnet.sui.io:443',
  WS_URL: 'wss://fullnode.mainnet.sui.io:443',
  PACKAGE_ID: '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80',
  MODULE: 'battle_garden',
  CONFIG_ID: '0x06c2b903bf9f805d8882e686d504a09593740deb2bc1a39eb67378e44089c749',
  MATCHMAKING_QUEUE_ID: '0x33bdce1ff2ba8a655e3601975f59808a1bcf4b3259bc9e7bbea79e91a50c37b4',
  SAPLING_STRUCT: '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80::battle_garden::SaplingNFT',
  ENTRY_FEE: 3_000_000_000, // 3 SUI in MIST
  RANDOM_OBJECT_CANDIDATES: ['0x8', '0x6'],
} as const;

export const MOVE_LABELS: Record<number, string> = {
  1: 'Thorn Spike Bomb (-10)',
  2: 'Razor Leaf Sword (-8)',
  3: 'Tumbleweed Mace (-12)',
  4: 'Shovel Spear (-7)',
  5: 'Thorned Whip (-9)',
  6: 'Acorn Slingshot (-6)',
  7: 'Stone Nunchuck (-11)',
  8: 'Cactus Shield (-5/Block)',
  9: 'Life Absorb (-8/+4)',
  10: 'Poison (-5x2)',
  11: 'Wither Touch (-15/20% Miss)',
  12: 'Pollen Cloud (-10/50% Block)',
  13: 'Fungal Rot (-7/next -3)',
  20: 'Roots Up (+10)',
  21: 'Sun Beam (+8-12)',
  22: 'Rain Storm (+15)',
  23: 'White Mold (+10/20% +5)',
  24: 'Greenhouse Gas (+12-18)',
  25: 'Potassium Power Up (+20/10% Fail)',
  26: 'Photosynthetic Surge (+15-20)',
  27: 'Barkskin Armor (+10/Block)',
  28: 'Sap Overflow (+12)',
  29: 'Cloud Cover (+8/50% Block)',
  30: 'Shadow Canopy (+10-15)',
};

export function getBattleUpdateEvent() {
  return `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::BattleUpdate`;
}
