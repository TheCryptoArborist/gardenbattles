const URL_BASE='https://tree-token.xyz/play/canopy-breaker/';
export function canopyCompletionMessage(entry){
 if(!/^[a-f0-9]{32}$/.test(entry.id)||!Number.isSafeInteger(entry.completedAt)||!Number.isSafeInteger(entry.score)||entry.score<0||!Number.isInteger(entry.level)||entry.level<1||entry.level>30||!['won','gameover'].includes(entry.outcome))throw Error('Invalid Canopy Breaker completion');
 const player=typeof entry.username==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/.test(entry.username)?entry.username:'An NFTree player';
 return {text:`🌳 Canopy Breaker run complete!\n\n${entry.outcome==='won'?'🏆 All 30 groves cleared!':'🧱 Three lives down — another canopy awaits!'}\nPlayer: ${player}\nScore: ${entry.score.toLocaleString('en-US')}\nGrove: ${entry.level} / 30\n\n${URL_BASE}`,reply_markup:{inline_keyboard:[[{text:'Play Canopy Breaker',url:URL_BASE},{text:'Leaderboard',url:URL_BASE+'#leaderboard'}]]}};
}
export async function pollCanopyCompletions({state,save,send,fetchFn=fetch}){
 const get=async suffix=>{
  const response=await fetchFn(URL_BASE+'api/completions'+suffix,{signal:AbortSignal.timeout(20000),headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error(`Canopy completion feed HTTP ${response.status}`);
  const page=await response.json();
  if(!Array.isArray(page.entries)||!page.cursor||!Number.isSafeInteger(page.cursor.at)||page.cursor.at<0||typeof page.cursor.key!=='string'||!/^([a-f0-9]{32})?$/.test(page.cursor.key)||typeof page.hasMore!=='boolean')throw Error('Invalid Canopy completion feed');
  return page;
 };
 if(!state.canopyCursor){
  const page=await get('?baseline=1');
  if(page.entries.length)throw Error('Canopy baseline must not return history');
  state.canopyCursor=page.cursor;save();
 }
 if(!state.canopyActivationSent){
  await send({text:'🌳 Canopy Breaker completed-game alerts are now active!\n\nNew saved runs will appear here with the public username (or an anonymous player label), score, grove reached, and result. Both full clears and game-over runs are included. Historical runs will not be reposted.'});
  state.canopyActivationSent=true;save();console.log('[nftree-alerts] Canopy Breaker activation test delivered');
 }
 for(let pages=0;pages<10;pages++){
  const page=await get(`?after=${state.canopyCursor.at}&key=${encodeURIComponent(state.canopyCursor.key)}`);
  for(const entry of page.entries){
   const message=canopyCompletionMessage(entry);
   if(!(state.canopyDelivered||[]).includes(entry.id)){
    await send(message);state.canopyDelivered=[...(state.canopyDelivered||[]),entry.id].slice(-10000);
    console.log(`[nftree-alerts] Canopy Breaker completed run delivered: ${entry.outcome}, score ${entry.score}`);
   }
   state.canopyCursor={at:entry.completedAt,key:entry.id};save();
  }
  state.canopyCursor=page.cursor;save();
  if(!page.hasMore)return;
 }
}
