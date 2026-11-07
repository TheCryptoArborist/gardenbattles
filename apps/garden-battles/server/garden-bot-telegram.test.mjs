import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GARDEN_BOT_STREAMS,prepareGardenBotEvent} from './garden-bot-telegram.mjs';
import {pollStream,eventMessage} from './nftree-telegram.mjs';
const event=(winner='0x123',type=GARDEN_BOT_STREAMS[0])=>({contents:{type:{repr:type},json:{battle_id:'0x789',player1:'0x123',player2:'0x456',winner:{vec:[winner]},player1_growth:'50',player2_growth:'32',target_growth:'50'}},transaction:{digest:'matchtx'}});
test('player victories and bot victories both notify',()=>{
 assert.match(eventMessage(prepareGardenBotEvent(event())).text,/Player victory/);
 assert.match(eventMessage(prepareGardenBotEvent(event('0x456'))).text,/Garden Bot wins/);
});
test('unfinished matches do not notify',()=>{const e=event();e.contents.json.winner={vec:[]};assert.equal(prepareGardenBotEvent(e),null);e.contents.json.winner='0x0000';assert.equal(prepareGardenBotEvent(e),null);});
test('legacy PvP does not notify; legacy bot completion does',()=>{const e=event('0x123',GARDEN_BOT_STREAMS[1]);assert.equal(prepareGardenBotEvent(e),null);e.contents.json.is_bot_battle=true;assert.ok(prepareGardenBotEvent(e));});
test('an unrelated winner is rejected',()=>{assert.throws(()=>prepareGardenBotEvent(event('0x999')),/Invalid completed/);});
test('repeated finish events and process restart send one alert per battle',async()=>{
 const state={cursors:{bot:'baseline'}};let sent=0;let persisted;
 const options={query:async()=>({edges:[{cursor:'a',node:event()},{cursor:'b',node:event()}],pageInfo:{endCursor:'b',hasNextPage:false}}),prepare:prepareGardenBotEvent,send:async()=>{sent++;},save:()=>{persisted=JSON.stringify(state);}};
 await pollStream('bot',state,options);assert.equal(sent,1);
 await pollStream('bot',JSON.parse(persisted),{...options,save:()=>{}});assert.equal(sent,1);
});
