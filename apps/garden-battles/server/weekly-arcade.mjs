import {weeklyDiscoveryLine} from './arcade-discovery.mjs';
import {trialRecord} from './arborist-trials-telegram.mjs';
import {createHash} from 'node:crypto';
export const ZONE='America/Chicago';
const DAY=86400000;
const parts=ms=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit',second:'2-digit'}).formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
function local19(date){let ms=date+19*3600000;for(let i=0;i<3;i++){const p=parts(ms);const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);ms+=(date+19*3600000)-represented;}return ms;}
export function weeklyPeriod(now){const p=parts(now),date=Date.UTC(p.year,p.month-1,p.day);let sunday=date-new Date(date).getUTCDay()*DAY;let end=local19(sunday);if(end>now){sunday-=7*DAY;end=local19(sunday);}return {start:local19(sunday-7*DAY),end,key:new Date(sunday).toISOString().slice(0,10)};}
const identity=wallet=>createHash('sha256').update('tree-arcade-weekly:'+wallet.toLowerCase()).digest('hex');
const addr=v=>{if(Array.isArray(v))return addr(v[0]);if(v&&typeof v==='object')return addr(v.vec??v.fields?.vec??v.value);return typeof v==='string'&&/^0x[0-9a-f]{1,64}$/i.test(v)&&!/^0x0+$/i.test(v)?'0x'+v.slice(2).toLowerCase().padStart(64,'0'):null;};
export function battleResult(event){const f=event.contents.json,player=addr(f.player1),other=addr(f.player2),winner=addr(f.winner);if(!winner)return null;
 if(!player||!other||![player,other].includes(winner)||!addr(f.battle_id))throw Error('Invalid weekly battle result');
 const at=Number(f.last_move_ms);if(!Number.isSafeInteger(at)||at<0)throw Error('Missing verified battle completion time');
 const bot=event.contents.type.repr.endsWith('::RankedBotBattleV2Update')||f.is_bot_battle===true;
 return {id:`${bot?'garden':'pvp'}:${addr(f.battle_id)}`,game:bot?'garden':'pvp',completedAt:at,players:(bot?[player]:[player,other]).map(wallet=>({playerId:identity(wallet),wallet,won:wallet===winner}))};
}
export function recordResult(weekly,record){if(record.completedAt<weekly.startedAt)return;const key=record.game+':'+record.id+(record.players?'':':'+record.score+':'+(record.outcome||record.cleared));if(!weekly.records[key])weekly.records[key]=record;}
const feeds=[['force','https://tree-token.xyz/api/treeforce89-leaderboard?completions=1&'],['canopy','https://tree-token.xyz/play/canopy-breaker/api/completions?']];
export async function collectWeekly({weekly,save,query,streams,listTrials,trialsStartedAt,fetchFn=fetch,now=Date.now()}){
 if(listTrials){
  if(!weekly.trialsStartedAt){weekly.trialsStartedAt=trialsStartedAt??now;save();}
  try{let cursor=weekly.cursors.trials||{at:weekly.trialsStartedAt,key:''};let complete=false;
   for(let i=0;i<100;i++){const rows=await listTrials(cursor,100);for(const row of rows){recordResult(weekly,trialRecord(row));cursor={at:row.completed_at,key:row.challenge_id+':'+row.wallet};weekly.cursors.trials=cursor;save();}if(rows.length<100){complete=true;break;}}
   if(!complete)throw Error('Trials backlog');weekly.health.trials={at:now};
  }catch{weekly.health.trials={...weekly.health.trials,error:true};console.error('[weekly-arcade] Arborist Trials collection incomplete');}save();
 }
 for(const [game,url]of feeds){try{let cursor=weekly.cursors[game]||{at:weekly.startedAt,key:''};let complete=false;
  for(let i=0;i<100;i++){const r=await fetchFn(`${url}after=${cursor.at}&key=${encodeURIComponent(cursor.key)}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error('Feed HTTP '+r.status);const p=await r.json();if(!Array.isArray(p.entries)||typeof p.hasMore!=='boolean'||!Number.isSafeInteger(p.cursor?.at)||typeof p.cursor.key!=='string')throw Error('Invalid feed');
   for(const e of p.entries){if(!/^[a-f0-9]{32}$/.test(e.id)||!/^[a-f0-9]{64}$/.test(e.playerId)||!Number.isSafeInteger(e.completedAt)||!Number.isSafeInteger(e.score)||e.score<0)throw Error('Invalid weekly score identity');recordResult(weekly,{...e,game});}
   cursor=p.cursor;weekly.cursors[game]=cursor;save();if(!p.hasMore){complete=true;break;}}
  if(!complete)throw Error('Weekly feed backlog');weekly.health[game]={at:now};
 }catch{weekly.health[game]={...weekly.health[game],error:true};console.error('[weekly-arcade] '+game+' collection incomplete');}save();}
 for(const type of streams){try{const key='chain:'+type;if(!Object.hasOwn(weekly.cursors,key)){const p=await query(type);weekly.cursors[key]=p.pageInfo.endCursor;save();}
  let complete=false;for(let i=0;i<100;i++){const p=await query(type,weekly.cursors[key]);for(const edge of p.edges){const record=battleResult(edge.node);if(record)recordResult(weekly,record);weekly.cursors[key]=edge.cursor;save();}if(p.pageInfo.endCursor)weekly.cursors[key]=p.pageInfo.endCursor;save();if(!p.pageInfo.hasNextPage){complete=true;break;}}
  if(!complete)throw Error('Weekly chain backlog');weekly.health[key]={at:now};
 }catch{weekly.health['chain:'+type]={...weekly.health['chain:'+type],error:true};console.error('[weekly-arcade] chain collection incomplete');}save();}
 weekly.lastCollected=now;weekly.records=Object.fromEntries(Object.entries(weekly.records).filter(([,r])=>r.completedAt>=now-35*DAY));save();
}
function playerName(r){const n=r.suinsName||r.username;if(typeof n==='string'&&/^[A-Za-z0-9 ._-]{1,80}$/.test(n))return n;return r.wallet||`Player ${r.playerId.slice(0,8)}`;}
const titles={force:'🚀 Tree Force ’89',canopy:'🧱 Canopy Breaker',garden:'🌱 Garden Bot',pvp:'⚔️ Garden PvP',trials:'🌳 Arborist Trials'};
export function buildWeekly(weekly,period){const records=Object.values(weekly.records).filter(r=>r.completedAt>=period.start&&r.completedAt<period.end);const fmt=ms=>new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(ms);
 const lines=['🌳 TREE ARCADE — WEEKLY ROUNDUP',`${fmt(period.start)} – ${fmt(period.end)} Central`];if(weekly.startedAt>period.start)lines.push(`First report: tracking began ${fmt(weekly.startedAt)} Central.`);
 let busiest=null;
 for(const game of ['force','canopy','garden','pvp',...(weekly.trialsStartedAt?['trials']:[])]){const runs=records.filter(r=>r.game===game);lines.push('\n'+titles[game]);if(game==='trials'&&weekly.trialsStartedAt>period.start)lines.push(`Tracking from ${fmt(weekly.trialsStartedAt)} Central.`);if(!runs.length){lines.push(game==='pvp'?'No recorded completed PvP matches.':'No recorded completions.');continue;}
  if(!busiest||runs.length>busiest.count)busiest={game,count:runs.length};
  if(game==='force'||game==='canopy'||game==='trials'){const best=new Map();for(const r of runs){const old=best.get(r.playerId);if(!old||r.score>old.score||(r.score===old.score&&r.completedAt<old.completedAt))best.set(r.playerId,r);}
   const top=[...best.values()].sort((a,b)=>b.score-a.score||a.completedAt-b.completedAt||a.playerId.localeCompare(b.playerId)).slice(0,3);top.forEach((r,i)=>lines.push(`${i+1}. ${playerName(r)} — ${r.score.toLocaleString('en-US')} · ${game==='force'?`wave ${r.wave} · ${r.badges||0} achievements`:game==='canopy'?`grove ${r.level}`:`${r.won?'win':'loss'} · ${r.rounds} rounds · ${r.challengeDate}`}`));
   if(game==='trials'){lines.push(`${runs.length} ranked trials · ${best.size} players · ${runs.filter(r=>r.won).length} wins`);continue;}
   const firstClear=runs.filter(r=>r.cleared||r.outcome==='won').sort((a,b)=>a.completedAt-b.completedAt)[0];if(firstClear)lines.push(`First full clear: ${playerName(firstClear)}`);
   lines.push(`${runs.length} saved endings · ${best.size} players · ${runs.filter(r=>r.cleared||r.outcome==='won').length} full clears`);if(game==='force')lines.push('Community scores saved by players; client reported.');
  }else{const players=new Map();for(const r of runs)for(const p of r.players){const s=players.get(p.playerId)||{...p,wins:0,matches:0};s.wins+=Number(p.won);s.matches++;players.set(p.playerId,s);}const top=[...players.values()].sort((a,b)=>b.wins-a.wins||b.matches-a.matches||a.playerId.localeCompare(b.playerId)).slice(0,3);top.forEach((p,i)=>lines.push(`${i+1}. ${playerName(p)} — ${p.wins} wins / ${p.matches} matches (${Math.round(100*p.wins/p.matches)}%)`));lines.push(`${runs.length} completed matches · ${players.size} players`);}
 }
 if(busiest)lines.push(`\nBusiest game: ${titles[busiest.game]} (${busiest.count} recorded endings).`);
 if(Object.values(weekly.health).some(h=>h.error||!h.at||h.at<period.end-10*60000))lines.push('\n⚠️ Some sources have incomplete coverage. These standings include recorded results only.');
 lines.push(weeklyDiscoveryLine(period.key));
 lines.push('\nOne score slot per player per game. Recognition only; no prize eligibility.','https://tree-token.xyz/play/');return {text:lines.join('\n'),reply_markup:{inline_keyboard:[[{text:'Play Tree Arcade',url:'https://tree-token.xyz/play/'}]]}};
}
export async function pollWeekly({state,save,send,query,streams,listTrials,trialsStartedAt,fetchFn=fetch,now=Date.now()}){
 if(!state.weeklyArcade){state.weeklyArcade={startedAt:now,cursors:{},records:{},health:{},reports:{}};save();}
 const w=state.weeklyArcade,p=weeklyPeriod(now),due=p.end>w.startedAt&&!w.reports[p.key];
 if(!w.lastCollected||now-w.lastCollected>=5*60000||due)await collectWeekly({weekly:w,save,query,streams,listTrials,trialsStartedAt,fetchFn,now});
 if(!w.activationSent){await send({text:'🌳 Weekly Tree Arcade roundups are scheduled for Sundays at 7 p.m. Central (America/Chicago).\n\nTop 3 per game, Garden Bot/PvP recorded wins, saved scores, waves/groves and full clears. SuiNS names are preferred. Tracking starts now; the first report will label its shorter coverage. Tree Force requires Save score. Recognition only — no prize eligibility.\n\nhttps://tree-token.xyz/play/'});w.activationSent=true;save();console.log('[weekly-arcade] Weekly Sunday 19:00 America/Chicago activation delivered');}
 if(!due)return;
 // Reserve before sending: ambiguous network failures must not post duplicate roundups.
 const message=buildWeekly(w,p);w.reports[p.key]={status:'sending',at:now};save();
 try{await send(message);w.reports[p.key]={status:'sent',at:now};save();console.log('[weekly-arcade] Delivered '+p.key);}
 catch(error){if(error instanceof Error&&/^Telegram sendMessage:/.test(error.message)){delete w.reports[p.key];save();throw error;}w.reports[p.key].status='uncertain';save();console.error('[weekly-arcade] Delivery uncertain; manual reconciliation required for '+p.key);throw error;}
}
