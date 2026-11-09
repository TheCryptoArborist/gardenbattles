import {createHash} from 'node:crypto';
export const TRIAL_URL='https://nftree.net/battle/trials';
// Internal SQLite query only; no new public result endpoint or writes.
export const TRIAL_COMPLETIONS_SQL=`SELECT *, challenge_id || ':' || wallet AS completion_key
 FROM arborist_trial_results
 WHERE (completed_at, challenge_id || ':' || wallet) > (?, ?)
 ORDER BY completed_at ASC, challenge_id || ':' || wallet ASC LIMIT ?`;
export function trialRecord(row){
 if(!/^arborist-trial-v\d+-\d{4}-\d{2}-\d{2}$/.test(row.challenge_id)||!/^\d{4}-\d{2}-\d{2}$/.test(row.challenge_date)||!/^0x[0-9a-f]{64}$/i.test(row.wallet)||!Number.isSafeInteger(row.completed_at)||row.completed_at<0||![0,1].includes(row.won)||![row.score,row.rounds,row.player_growth,row.bot_growth,row.unique_moves].every(n=>Number.isSafeInteger(n)&&n>=0)||row.rounds<1)throw Error('Invalid saved Arborist Trial');
 const wallet=row.wallet.toLowerCase();
 return {id:createHash('sha256').update(row.challenge_id+':'+wallet).digest('hex'),game:'trials',playerId:createHash('sha256').update('tree-arcade-weekly:'+wallet).digest('hex'),wallet,completedAt:row.completed_at,challengeDate:row.challenge_date,score:row.score,won:row.won===1,rounds:row.rounds,playerGrowth:row.player_growth,botGrowth:row.bot_growth,uniqueMoves:row.unique_moves};
}
export function trialCompletionMessage(row){const r=trialRecord(row);return {text:`🌳 Arborist Trials complete!\n\n${r.won?'🏆 Daily trial victory!':'🌱 Daily trial finished — another challenge awaits!'}\nPlayer: ${r.wallet}\nChallenge: ${r.challengeDate} (UTC)\nResult: ${r.won?'Win':'Loss'}\nScore: ${r.score.toLocaleString('en-US')}\nRounds: ${r.rounds}\nGrowth: ${r.playerGrowth} (player) · ${r.botGrowth} (opponent)\nUnique moves: ${r.uniqueMoves}\n\n${TRIAL_URL}`,reply_markup:{inline_keyboard:[[{text:'Play Arborist Trials',url:TRIAL_URL}]]}};}
export async function pollTrialCompletions({state,save,send,listTrials,now=Date.now()}){
 if(typeof listTrials!=='function')throw Error('Arborist Trials result source is unavailable');
 if(!state.trialsStartedAt){state.trialsStartedAt=now;save();}
 if(!state.trialsCursor){state.trialsCursor={at:state.trialsStartedAt,key:''};save();}
 for(let page=0;page<10;page++){
  const rows=await listTrials(state.trialsCursor,100);if(!Array.isArray(rows))throw Error('Invalid Arborist Trials page');
  for(const row of rows){const message=trialCompletionMessage(row);const key=row.challenge_id+':'+row.wallet;await send(message);state.trialsCursor={at:row.completed_at,key};save();console.log('[nftree-alerts] Arborist Trials verified completion delivered');}
  if(rows.length<100)break;
 }
 if(!state.trialsActivationSent){await send({text:'🌳 Arborist Trials completion alerts are now active!\n\nNew saved ranked trials will appear here with the result, score, rounds and growth totals. SuiNS names appear when available. Wins and losses count; practice runs, duplicate saves and historical results are excluded from individual alerts.\n\nArborist Trials is also included in the Sunday 7 p.m. Central weekly roundup, using each player’s best recorded weekly score.\n\n'+TRIAL_URL});state.trialsActivationSent=true;save();console.log('[nftree-alerts] Arborist Trials activation delivered');}
}
