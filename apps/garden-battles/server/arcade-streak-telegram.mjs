const endpoint='https://tree-token.xyz/api/arcade-streak-milestones';
const validDays=n=>Number.isSafeInteger(n)&&(n===3||n===7||n===14||n>=30&&n%30===0);
const labels={seedling:'TREE Spark',sapling:'NFTree Scout','deep-roots':'TREE FORCE Vanguard','full-canopy':'Thickquidity Legend','arcade-passport':'Arcade Passport'};
export function streakMessage(e){
 if(!/^[a-f0-9]{32}$/.test(e.id)||!Number.isSafeInteger(e.at)||e.at<0||!validDays(e.days)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^0x[0-9a-f]{6}…[0-9a-f]{6}$/.test(e.walletLabel))throw Error('Invalid Arcade streak milestone');
 const name=typeof e.suinsName==='string'&&/^(?:[a-z0-9-]+\.)+sui$/i.test(e.suinsName)&&e.suinsName.length<=253?e.suinsName:e.walletLabel;
 const badges=Array.isArray(e.badges)?[...new Set(e.badges)].filter(b=>Object.hasOwn(labels,b)).map(b=>labels[b]):[];
 return {text:`🔥 ${name} reached a ${e.days}-day Tree Arcade check-in streak!\n\n🌳 ${e.days} consecutive days of keeping the canopy growing.\nCheck-in date: ${e.date} (UTC)${badges.length?'\n🏅 Newly earned: '+badges.join(', '):''}\n\nhttps://tree-token.xyz/play/`,reply_markup:{inline_keyboard:[[{text:'Visit Tree Arcade',url:'https://tree-token.xyz/play/'}]]}};
}
export async function pollStreakMilestones({state,save,send,fetchFn=fetch,now=Date.now()}){
 const ledger=state.arcadeStreak||(state.arcadeStreak={lastScan:0,deliveries:{},activationSent:false});save();
 let cursor={at:Math.max(0,ledger.lastScan-300000),key:''},complete=false;
 for(let page=0;page<100;page++){
  const r=await fetchFn(`${endpoint}?after=${cursor.at}&key=${encodeURIComponent(cursor.key)}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error('Arcade streak feed HTTP '+r.status);const p=await r.json();
  if(!Array.isArray(p.entries)||typeof p.hasMore!=='boolean'||!Number.isSafeInteger(p.cursor?.at)||!/^([a-f0-9]{32})?$/.test(p.cursor?.key))throw Error('Invalid Arcade streak feed');
  for(const e of p.entries){const message=streakMessage(e);if(ledger.deliveries[e.id])continue;
   ledger.deliveries[e.id]='sending';save();
   try{await send(message);ledger.deliveries[e.id]='sent';save();console.log(`[nftree-alerts] Arcade ${e.days}-day check-in milestone delivered`);}
   catch(error){if(error instanceof Error&&/^Telegram sendMessage:/.test(error.message))delete ledger.deliveries[e.id];else ledger.deliveries[e.id]='uncertain';save();throw error;}
  }
  cursor=p.cursor;if(!p.hasMore){complete=true;break;}
 }
 if(!complete)throw Error('Arcade milestone backlog; retrying without advancing');ledger.lastScan=now;save();
 if(!ledger.activationSent){await send({text:'🔥 Tree Arcade check-in streak alerts are now active!\n\nMilestones: 3, 7, 14 and 30 days, then every additional 30 days. Each milestone is announced once per player, using a SuiNS name when available. Only confirmed check-ins count; signing in, refreshing and paid recovery dates do not generate streak alerts.\n\nhttps://tree-token.xyz/play/'});ledger.activationSent=true;save();console.log('[nftree-alerts] Arcade streak milestone activation delivered');}
}
