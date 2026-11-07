import {test} from 'node:test';import assert from 'node:assert/strict';
import {pollCanopyCompletions,canopyCompletionMessage} from './canopy-breaker-telegram.mjs';
const entry={id:'a'.repeat(32),completedAt:100,score:12345,level:7,outcome:'gameover',username:'Tree Player'};
const page=entries=>({entries,cursor:{at:100,key:entries.at(-1)?.id||''},hasMore:false});
test('both game over and full clear format with public username only',()=>{
 assert.match(canopyCompletionMessage(entry).text,/12,345/);assert.match(canopyCompletionMessage({...entry,outcome:'won',level:30}).text,/All 30 groves cleared/);
 assert.match(canopyCompletionMessage({...entry,username:null}).text,/An NFTree player/);
});
test('baseline skips history and sends one activation',async()=>{
 const state={};let sends=0;
 const options={state,save:()=>{},send:async()=>sends++,fetchFn:async url=>Response.json(url.includes('baseline')?page([]):page([]))};
 await pollCanopyCompletions(options);await pollCanopyCompletions(options);assert.equal(sends,1);
});
test('failure retries without advancing; restarted poll deduplicates',async()=>{
 const state={canopyCursor:{at:1,key:''},canopyActivationSent:true};let snapshot;let sends=0;
 const options={state,save:()=>{snapshot=JSON.stringify(state);},fetchFn:async()=>Response.json(page([entry]))};
 await assert.rejects(pollCanopyCompletions({...options,send:async()=>{throw Error('Telegram offline');}}),/offline/);assert.equal(state.canopyCursor.at,1);
 await pollCanopyCompletions({...options,send:async()=>sends++});
 await pollCanopyCompletions({...options,state:JSON.parse(snapshot),send:async()=>sends++});assert.equal(sends,1);
});
test('malformed data and failed feed cannot activate alerts',async()=>{
 const state={};await assert.rejects(pollCanopyCompletions({state,save:()=>{},send:async()=>assert.fail(),fetchFn:async()=>new Response('unavailable',{status:503})}),/503/);assert.equal(state.canopyCursor,undefined);
});

test('SuiNS takes precedence over the optional username',()=>{assert.match(canopyCompletionMessage({...entry,suinsName:'tree.sui'}).text,/Player: tree.sui/);});
