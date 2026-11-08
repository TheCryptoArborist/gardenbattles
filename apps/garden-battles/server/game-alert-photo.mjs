export const GAME_ALERT_IMAGES={
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
 for(const [game,title,url]of [['force','TREE FORCE ’89','https://tree-token.xyz/play/treeforce89/'],['canopy','Canopy Breaker','https://tree-token.xyz/play/canopy-breaker/']]){
  const key=game+'ArtworkEnabled';if(state[key])continue;
  // This clearly labeled setup notice also checks that Telegram accepts the
  // uploaded artwork; it is never represented as a player's real result.
  await telegram('sendPhoto',{photo:GAME_ALERT_IMAGES[game],caption:`🌳 ${title} alert artwork enabled!\n\nFuture completed-game alerts will use this image with the player name, score and game result.\n\n${url}`,reply_markup:{inline_keyboard:[[{text:'Play '+title,url}]]}});
  state[key]=true;save();console.log(`[nftree-alerts] ${game} artwork delivered to Telegram`);
 }
}
