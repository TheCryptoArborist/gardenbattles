const endpoint='https://tree-token.xyz/api/treeforce89-leaderboard?completions=1';
const game='https://tree-token.xyz/play/treeforce89/';
export function treeForceMessage(e){
 if(!/^[a-f0-9]{32}$/.test(e.id)||!Number.isSafeInteger(e.completedAt)||!Number.isSafeInteger(e.score)||e.score<0||!Number.isInteger(e.wave)||e.wave<1||e.wave>10||typeof e.cleared!=='boolean')throw Error('Invalid TREE FORCE ending');
 const name=typeof e.suinsName==='string'&&/^(?:[a-z0-9-]+\.)+sui$/i.test(e.suinsName)?e.suinsName:typeof e.username==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/.test(e.username)?e.username:'An NFTree pilot';
 return {text:`🌳 TREE FORCE ’89 mission complete!\n\n${e.cleared?'🏆 Canopy Tyrant defeated!':'🚀 Patrol finished — ready for another flight?'}\nPilot: ${name}\nScore: ${e.score.toLocaleString('en-US')}\nWave reached: ${e.wave}\nAchievements this run: ${Number.isInteger(e.badges)?e.badges:0}\n\n${game}`,reply_markup:{inline_keyboard:[[{text:'Play TREE FORCE ’89',url:game}]]}};
}
export async function pollTreeForceCompletions({state,save,send,fetchFn=fetch}){
 const get=async suffix=>{const r=await fetchFn(endpoint+suffix,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error(`TREE FORCE completion feed HTTP ${r.status}`);const p=await r.json();if(!Array.isArray(p.entries)||!Number.isSafeInteger(p.cursor?.at)||p.cursor.at<0||typeof p.cursor.key!=='string'||!/^([a-f0-9]{32})?$/.test(p.cursor.key)||typeof p.hasMore!=='boolean')throw Error('Invalid TREE FORCE completion feed');return p;};
 if(!state.treeForceCursor){const p=await get('&baseline=1');if(p.entries.length)throw Error('Baseline contains history');state.treeForceCursor=p.cursor;save();}
 for(let i=0;i<10;i++){
  const p=await get(`&after=${state.treeForceCursor.at}&key=${encodeURIComponent(state.treeForceCursor.key)}`);
  for(const e of p.entries){const m=treeForceMessage(e);if(!(state.treeForceDelivered||[]).includes(e.id)){await send(m);state.treeForceDelivered=[...(state.treeForceDelivered||[]),e.id].slice(-10000);console.log(`[nftree-alerts] TREE FORCE saved ending delivered; score ${e.score}`);}state.treeForceCursor={at:e.completedAt,key:e.id};save();}
  state.treeForceCursor=p.cursor;save();if(!p.hasMore)break;
 }
 if(!state.treeForceActivationSent){await send({text:'🌳 TREE FORCE ’89 completed-mission alerts are now active!\n\nSave your finished standard run using Save score to announce the pilot name, score, wave and achievements here. Primary SuiNS names appear when available. Practice runs and historical scores are excluded.'});state.treeForceActivationSent=true;save();console.log('[nftree-alerts] TREE FORCE activation notice delivered');}
}
