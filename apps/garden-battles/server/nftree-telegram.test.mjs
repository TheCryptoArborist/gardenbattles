import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventMessage, pollStream } from './nftree-telegram.mjs';
const type = 'pkg::collection::NFTPurchased';
const edge = n => ({cursor: `event-${n}`, node: {contents: {type: {repr: type}, json: {object_id: '0x1234', number: String(n), buyer: '0x5678', price_mist: '25000000001'}}, transaction: {digest: `tx${n}`}}});
test('baseline skips history, persists the checkpoint', async () => {
  const state = {cursors: {}}; let saves = 0;
  await pollStream(type, state, {query: async () => ({edges: [edge(1)], pageInfo: {endCursor: 'baseline'}}), send: async () => assert.fail('historical send'), save: () => saves++});
  assert.equal(state.cursors[type], 'baseline'); assert.equal(saves, 1);
});
test('failed delivery retains the last delivered cursor; restart retries remaining events', async () => {
  const state = {cursors: {[type]: 'baseline'}}; const delivered = []; let snapshot;
  await assert.rejects(pollStream(type, state, {query: async () => ({edges: [edge(1),edge(2)],pageInfo: {endCursor:'end',hasNextPage:false}}), send: async msg => { if(msg.text.includes('#2')) throw new Error('offline'); delivered.push(msg.text); }, save: () => { snapshot = JSON.stringify(state); }}), /offline/);
  assert.equal(state.cursors[type], 'event-1');
  const restarted = JSON.parse(snapshot);
  await pollStream(type, restarted, {query: async (_t, cursor) => {assert.equal(cursor,'event-1'); return {edges:[edge(2)],pageInfo:{endCursor:'end',hasNextPage:false}};}, send: async msg => delivered.push(msg.text), save: () => {}});
  assert.equal(delivered.length,2); assert.equal(restarted.cursors[type], 'end');
});
test('pagination drains every page in order', async () => {
  const state = {cursors: {[type]: 'baseline'}}; let calls = 0; let sends = 0;
  await pollStream(type,state,{query:async () => {calls++; return {edges:[edge(calls)],pageInfo:{endCursor:`page-${calls}`,hasNextPage:calls===1}};},send:async()=>{sends++;},save:()=>{}});
  assert.equal(calls,2);assert.equal(sends,2);assert.equal(state.cursors[type],'page-2');
});
test('exact SUI amount and transaction appear in purchase alert', () => {
  const msg = eventMessage(edge(7).node);
  assert.match(msg.text,/25\.000000001 SUI/); assert.match(msg.text,/#7/); assert.match(msg.text,/tx7/); assert.match(msg.photo,/\/7.jpg$/);
});
test('inventory mints are labeled accurately and no price is invented', () => {
  const node=edge(8).node;node.contents.type.repr='pkg::collection::NFTMinted';node.contents.json.recipient='0x0000';
  assert.match(eventMessage(node).text,/sale inventory/);assert.doesNotMatch(eventMessage(node).text,/Price:/);
});
