export const GAME_ALERT_IMAGES={
 weekly:'https://gardenbattles-production.up.railway.app/images/weekly-arcade-roundup.jpg',
 quest:'https://gardenbattles-production.up.railway.app/images/daily-quest-spotlight.jpg',
 trialsSpotlight:'https://gardenbattles-production.up.railway.app/images/arborist-trials-spotlight.jpg',
 gardenSpotlight:'https://gardenbattles-production.up.railway.app/images/garden-bot-spotlight.jpg',
 trials:'https://gardenbattles-production.up.railway.app/images/arborist-trials-alert.jpg',
 force:'https://gardenbattles-production.up.railway.app/images/treeforce89-alert.png',
 canopy:'https://gardenbattles-production.up.railway.app/images/canopy-breaker-alert.png',
};
export async function sendGameAlert(message,telegram){
 if(!message.photo)return telegram('sendMessage',{text:message.text,reply_markup:message.reply_markup,disable_web_page_preview:true});
 try{return await telegram('sendPhoto',{photo:message.photo,caption:message.text,reply_markup:message.reply_markup});}
 catch(error){
  // Telegram may have accepted a timed-out request: never send a second alert
  // unless Telegram explicitly rejects this particular image.
  if(!(error instanceof Error)||!/^Telegram sendPhoto:/.test(error.message)||!/photo|image|wrong file|failed to get http url/i.test(error.message.replace(/^Telegram sendPhoto:/,'')))throw error;
  return telegram('sendMessage',{text:message.text,reply_markup:message.reply_markup,disable_web_page_preview:true});
 }
}
export async function announceGameArtwork({state,save,telegram}){
 if(!state.trialsArtworkTest20261110){
  await telegram('sendPhoto',{photo:GAME_ALERT_IMAGES.trials,caption:'🧪 TEST — Arborist Trials complete!\n\nThis is a notification preview, not a real player result.\n\nPlayer: Demonstration\nResult: Win (example)\nScore: 12,345 (example)\nRounds: 8 (example)\nGrowth: 50 (player) · 27 (opponent) (example)\n\nFuture ranked completion alerts will include the actual player and results.\nwww.tree-token.xyz',reply_markup:{inline_keyboard:[[{text:'Play Arborist Trials',url:'https://nftree.net/battle/trials'}]]}});
  state.trialsArtworkTest20261110=true;save();console.log('[nftree-alerts] Arborist Trials test artwork delivered to Telegram');
 }
 for(const [game,title,url]of [['force','TREE FORCE ’89','https://tree-token.xyz/play/treeforce89/'],['canopy','Canopy Breaker','https://tree-token.xyz/play/canopy-breaker/']]){
  const key=game+'ArtworkEnabled';if(state[key])continue;
  // This clearly labeled setup notice also checks that Telegram accepts the
  // uploaded artwork; it is never represented as a player's real result.
  await telegram('sendPhoto',{photo:GAME_ALERT_IMAGES[game],caption:`🌳 ${title} alert artwork enabled!\n\nFuture completed-game alerts will use this image with the player name, score and game result.\n\n${url}`,reply_markup:{inline_keyboard:[[{text:'Play '+title,url}]]}});
  state[key]=true;save();console.log(`[nftree-alerts] ${game} artwork delivered to Telegram`);
 }
}

// Long standings remain complete: deliver a cover, then the original report.
export async function sendWeeklyAlert(message,telegram){
 if(!message.photo||message.text.length<=1024)return sendGameAlert(message,telegram);
 await telegram('sendPhoto',{photo:message.photo,caption:'🌳 TREE ARCADE — WEEKLY ROUNDUP\n\nSee the full standings in the next message. Ready for your next run?\nhttps://tree-token.xyz/play/',reply_markup:message.reply_markup});
 try{return await telegram('sendMessage',{text:message.text,reply_markup:message.reply_markup,disable_web_page_preview:true});}
 catch{throw Error('Weekly standings delivery uncertain after artwork was accepted; manual review required');}
}
