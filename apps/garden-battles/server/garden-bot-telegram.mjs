const fallback = '0x50864e060caca53c7c50a355f7550276b52f91a0bd1e7b1e54ac9dbb754ef299';
const moduleName = process.env.BATTLE_MODULE || 'battle';
export const GARDEN_BOT_STREAMS = [
  `${process.env.RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID || process.env.BATTLE_PACKAGE_ID || process.env.PACKAGE_ID || fallback}::${moduleName}::RankedBotBattleV2Update`,
  `${process.env.BATTLE_EVENT_PACKAGE_ID || process.env.BATTLE_ORIGINAL_PACKAGE_ID || '0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b'}::${moduleName}::BattleUpdate`,
];
function address(value) {
  if (Array.isArray(value)) return address(value[0]);
  if (value && typeof value === 'object') return address(value.vec ?? value.fields?.vec ?? value.value);
  return typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value) && !/^0x0+$/i.test(value) ? value.toLowerCase() : null;
}
export function prepareGardenBotEvent(event) {
  const type = event.contents.type.repr;
  if (!GARDEN_BOT_STREAMS.includes(type)) return null;
  const f = event.contents.json;
  if (type.endsWith('::BattleUpdate') && f.is_bot_battle !== true) return null;
  const winner = address(f.winner);
  if (!winner) return null;
  const player = address(f.player1), bot = address(f.player2);
  if (!player || !bot || (winner !== player && winner !== bot) || !address(f.battle_id)) throw new Error('Invalid completed Garden Bot match');
  const growth = [f.player1_growth, f.player2_growth].map(value => String(value));
  if (!growth.every(value => /^\d+$/.test(value))) throw new Error('Invalid Garden Bot growth');
  const won = winner === player;
  return {...event, notificationKind:'garden-bot', notification: {
    text: `🌳 Garden Bot match complete!\n\n${won ? '🏆 Player victory!' : '🤖 Garden Bot wins — ready for a rematch?'}\nPlayer: ${player}\nGrowth: ${growth[0]} (player) · ${growth[1]} (Garden Bot)${/^\d+$/.test(String(f.target_growth)) ? `\nTarget: ${f.target_growth} Growth` : ''}\n\nhttps://suiscan.xyz/mainnet/tx/${event.transaction.digest}`,
    saleKey: `garden-bot:${String(f.battle_id).toLowerCase()}`,
    reply_markup:{inline_keyboard:[[{text:'Play Garden Bot',url:'https://nftree.net/battle/garden-bot'},{text:'View match transaction',url:`https://suiscan.xyz/mainnet/tx/${event.transaction.digest}`}]]},
  }};
}
