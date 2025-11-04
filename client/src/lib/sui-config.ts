// Sui Blockchain Configuration - SUI MAIN PUBLIC FULL NODE ENDPOINTS
export const SUI_CONFIG = {
  NETWORK: 'mainnet',
  RPC_URL: 'https://fullnode.mainnet.sui.io:443',
  WS_URL: 'wss://fullnode.mainnet.sui.io:443',
  PACKAGE_ID: '0x6bdfb7a07529f20d971c68ec57e3ac0c3d03b0b309d1624d141df4a102cad01',
  MODULE: 'battle_garden',
  CONFIG_ID: '0x35b10278cf1bbebd5a43df3222e490af2796fb78f3a2c4a59e3debf08aef8587',
  MATCHMAKING_QUEUE_ID: '0xd23445c667c5826a6d58636d980d00612a78a921761fd3df18b577d4acb194f2',
  SAPLING_STRUCT: '0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft',
  ENTRY_FEE: 3_000_000_000, // 3 SUI in MIST
  RANDOM_OBJECT_CANDIDATES: ['0x8', '0x6'],
  ADMIN_ADDRESSES: [
    '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4', // Contract deployer
    '0x8d73665b159d406d1bd208782cbba5304900ecafbde23f957f77843b5ea06961', // Your wallet
  ],
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
