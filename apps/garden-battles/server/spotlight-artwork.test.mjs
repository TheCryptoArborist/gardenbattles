import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GAME_ALERT_IMAGES,sendWeeklyAlert} from './game-alert-photo.mjs';
import {DISCOVERY_GAMES,gameSpotlight,discoveryMessage} from './arcade-discovery.mjs';
import {buildWeekly,weeklyPeriod} from './weekly-arcade.mjs';
test('game spotlights use approved individual art and correct play destinations',()=>{
 for(const [id,key] of [['arborist-trials','trialsSpotlight'],['garden-bot','gardenSpotlight']]){
  const game=DISCOVERY_GAMES.find(g=>g.id===id),m=gameSpotlight(game);
  assert.equal(m.photo,GAME_ALERT_IMAGES[key]);assert.equal(m.reply_markup.inline_keyboard[0][0].url,game.url);assert(m.text.length<=1024);
 }
});
test('verified daily quest carries approved quest art',async()=>{
 const now=Date.parse('2026-11-10T16:00Z');
 const message=await discoveryMessage({ordinal:4},async()=>Response.json({status:'ok',dateKey:'2026-11-10',configuration:{resetAt:'2026-11-11T00:00Z',todayPick:{id:'arborist-trials',creditRule:'complete-result'},enabledGames:[{id:'arborist-trials'}]}}),now);
 assert.equal(message.photo,GAME_ALERT_IMAGES.quest);assert.match(message.text,/Arborist Trials/);assert.equal(message.reply_markup.inline_keyboard[0][0].url,'https://tree-token.xyz/play/');
});
test('weekly builder includes roundup graphic',()=>{
 const message=buildWeekly({records:{},health:{},startedAt:0},weeklyPeriod(Date.parse('2026-11-16T02:00Z')));
 assert.equal(message.photo,GAME_ALERT_IMAGES.weekly);
});
test('long weekly report sends cover followed by untruncated standings',async()=>{
 const message={photo:GAME_ALERT_IMAGES.weekly,text:'standings '.repeat(300),reply_markup:{inline_keyboard:[]}},calls=[];
 await sendWeeklyAlert(message,async(method,body)=>calls.push({method,body}));
 assert.deepEqual(calls.map(c=>c.method),['sendPhoto','sendMessage']);assert(calls[0].body.caption.length<=1024);assert.equal(calls[1].body.text,message.text);
});
test('partial weekly delivery is uncertain rather than retried as a new report',async()=>{
 let n=0;await assert.rejects(sendWeeklyAlert({photo:GAME_ALERT_IMAGES.weekly,text:'x'.repeat(2000)},async()=>{if(++n===2)throw Error('Telegram sendMessage: rejected');}),/manual review required/);assert.equal(n,2);
});
