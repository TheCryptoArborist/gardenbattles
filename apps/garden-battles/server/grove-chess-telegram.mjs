const endpoint='https://tree-token.xyz/api/grove-chess?action=invitations';
export const GROVE_CHESS_COVER='https://tree-token.xyz/play/grove-chess/assets/grove-chess-cover.png';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function groveChessInvitation(entry,now=Date.now()){
 if(!entry||!uuid.test(entry.id)||!Number.isSafeInteger(entry.createdAt)||!Number.isSafeInteger(entry.expiresAt)||entry.createdAt>now+60000||entry.expiresAt<=entry.createdAt||entry.expiresAt-entry.createdAt>900000)throw Error('Invalid Grove Chess invitation');
 if(entry.status!=='waiting'||entry.expiresAt<=now)return null;
 const url='https://tree-token.xyz/play/grove-chess/?room='+entry.id;
 return {photo:GROVE_CHESS_COVER,text:'🌳 ♟ A challenger awaits in Grove Chess!\n\nThe board is set. The Tree Hero needs a strategist. Will you lead your woodland pieces to victory?\n\nJoin a live two-player match in the TREE Arcade — first to take the open seat plays!\n\nTwo free games per browser; NFTree ownership unlocks continued play.\n\nThis invitation expires after 15 minutes.\n'+url,reply_markup:{inline_keyboard:[[{text:'♟ Take the open seat',url}]]}};
}
// No startup announcement or historical replay. Only explicit, still-open
// opponent requests are eligible. Persist before sending: a network timeout may
// mean Telegram accepted the photo, so an uncertain send must not be repeated.
export async function pollGroveChessInvitations({state,save,send,fetchFn=fetch,now=Date.now}){
 const response=await fetchFn(endpoint,{signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!response.ok)throw Error('Grove Chess invitation feed HTTP '+response.status);
 const body=await response.json();if(!Array.isArray(body.entries)||body.entries.length>100)throw Error('Invalid Grove Chess invitation feed');
 const time=now();
 state.groveChessAttempted=(state.groveChessAttempted||[]).filter(e=>Number.isSafeInteger(e.expiresAt)&&e.expiresAt>time);
 for(const entry of body.entries){
  const message=groveChessInvitation(entry,time);
  if(!message||state.groveChessAttempted.some(e=>e.id===entry.id))continue;
  state.groveChessAttempted.push({id:entry.id,expiresAt:entry.expiresAt});save();
  await send(message);
 }
}
