import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groveChessInvitation,pollGroveChessInvitations,GROVE_CHESS_COVER} from './grove-chess-telegram.mjs';
const now=1000000,entry={id:'12345678-1234-4123-8123-123456789012',createdAt:now,expiresAt:now+900000,status:'waiting'};
test('uses exact cabinet art and a fixed official join link',()=>{
 const m=groveChessInvitation(entry,now);assert.equal(m.photo,GROVE_CHESS_COVER);assert.equal(m.reply_markup.inline_keyboard[0][0].url,'https://tree-token.xyz/play/grove-chess/?room='+entry.id);assert.ok(m.text.length<1024);assert.match(m.text,/Two free games/);
 assert.throws(()=>groveChessInvitation({...entry,id:'https://evil.example'},now));
 assert.equal(groveChessInvitation({...entry,status:'playing'},now),null);
 assert.equal(groveChessInvitation(entry,entry.expiresAt),null);
});
test('persists before delivery and never repeats ambiguous sends after restart',async()=>{
 const state={};let saved,attempts=0;
 const options={state,save:()=>{saved=JSON.parse(JSON.stringify(state));},now:()=>now,fetchFn:async()=>Response.json({entries:[entry]}),send:async()=>{attempts++;assert.equal(saved.groveChessAttempted[0].id,entry.id);throw Error('timeout');}};
 await assert.rejects(pollGroveChessInvitations(options),/timeout/);
 await pollGroveChessInvitations({...options,state:saved});assert.equal(attempts,1);
});
test('rejects failed feeds and ignores closed or expired invitations',async()=>{
 const options={state:{},save:()=>{},now:()=>now,send:async()=>assert.fail('No invitation expected')};
 await assert.rejects(pollGroveChessInvitations({...options,fetchFn:async()=>new Response('',{status:503})}),/503/);
 await pollGroveChessInvitations({...options,fetchFn:async()=>Response.json({entries:[{...entry,status:'playing'},{...entry,createdAt:0,expiresAt:1}]})});
});
