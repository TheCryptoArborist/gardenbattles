import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRADEPORT_STREAMS, prepareTradeportEvent, readSaleNft, SaleNftUnavailableError} from './tradeport-telegram.mjs';
import {deferTradeportEvent, retryDeferredTradeportEvents} from './tradeport-recovery.mjs';
import {COLLECTION, eventMessage, pollStream} from './nftree-telegram.mjs';
const nft={type:{repr:`${COLLECTION}::collection::NFT`},json:{number:'301',image_url:'https://example.com/301.jpg'}};
const sale = (type=TRADEPORT_STREAMS[0]) => ({contents:{type:{repr:type},json:{nft_id:'0x1234',seller:'0xabcd',buyer:'0x5678',price:'25000000001'}},transaction:{digest:'saleTx'}});
test('all supported listing contracts normalize into NFTree resale alerts',async()=>{
 for(const type of TRADEPORT_STREAMS.slice(0,3)){
  const event=await prepareTradeportEvent(sale(type),async()=>nft);const msg=eventMessage(event);
  assert.match(msg.text,/sold on TradePort/);assert.match(msg.text,/25\.000000001 SUI/);assert.match(msg.text,/Seller: 0xabcd/);assert.match(msg.text,/Buyer: 0x5678/);assert.equal(msg.photo,'https://example.com/301.jpg');
 }
});
test('other collections never alert',async()=>{
 assert.equal(await prepareTradeportEvent(sale(),async()=>({...nft,type:{repr:'0x111::other::NFT'}})),null);
});
test('listings and cancellations never alert or read objects',async()=>{
 for(const suffix of ['CreateSimpleListingEvent','CancelSimpleListingEvent','RelistSimpleListingEvent']){
 const event=sale(TRADEPORT_STREAMS[2].replace('BuySimpleListingEvent',suffix));
 assert.equal(await prepareTradeportEvent(event,async()=>assert.fail('lookup')),null);
 }
});
test('metadata lookup failure retains cursor for retry',async()=>{
 const state={cursors:{sale:'checkpoint'}};
 await assert.rejects(pollStream('sale',state,{query:async()=>({edges:[{cursor:'after',node:sale()}],pageInfo:{endCursor:'end',hasNextPage:false}}),prepare:event=>prepareTradeportEvent(event,async()=>{throw new Error('RPC timeout');}),send:async()=>assert.fail('send'),save:()=>{}}),/RPC timeout/);
 assert.equal(state.cursors.sale,'checkpoint');
});
test('unrelated sales advance the cursor and do not block later NFTree sales',async()=>{
 const state={cursors:{sale:'checkpoint'}};let sends=0;
 const unrelated=sale();unrelated.contents.json.nft_id='0x111';
 await pollStream('sale',state,{query:async()=>({edges:[{cursor:'one',node:unrelated},{cursor:'two',node:sale()}],pageInfo:{endCursor:'end',hasNextPage:false}}),prepare:event=>prepareTradeportEvent(event,async id=>id==='0x111'?{...nft,type:{repr:'other'}}:nft),send:async()=>{sends++;},save:()=>{}});
 assert.equal(sends,1);assert.equal(state.cursors.sale,'end');
});
test('duplicate receipts for one NFT sale send once; another NFT in same transaction still sends',async()=>{
 const state={cursors:{sale:'checkpoint'}};let sends=0;const other=sale();other.contents.json.nft_id='0x999';
 await pollStream('sale',state,{query:async()=>({edges:[{cursor:'one',node:sale()},{cursor:'two',node:sale()},{cursor:'three',node:other}],pageInfo:{endCursor:'end',hasNextPage:false}}),prepare:event=>prepareTradeportEvent(event,async()=>nft),send:async()=>{sends++;},save:()=>{}});
 assert.equal(sends,2);
});
test('accepted single bids identify seller from transaction sender',async()=>{
 const event=sale(TRADEPORT_STREAMS.at(-1));delete event.contents.json.seller;
 event.transaction.sender={address:'0xabcd'};
 const normalized=await prepareTradeportEvent(event,async()=>nft);
 assert.equal(normalized.contents.json.seller,'0xabcd');
});
test('bid events with another collection type are rejected without an object lookup',async()=>{
 const event=sale(TRADEPORT_STREAMS[3]);event.contents.json.nft_type='111::other::NFT';
 assert.equal(await prepareTradeportEvent(event,async()=>assert.fail('lookup')),null);
});

const moveState = contents => ({asMoveObject:{contents}});
const transactionPage = (nodes, endCursor=null, hasNextPage=false) => ({
 transaction:{effects:{objectChanges:{nodes,pageInfo:{endCursor,hasNextPage}}}},
});
function mockedGraphql(responses, requests=[]) {
 return async (_url, options) => {
  requests.push(JSON.parse(options.body));
  assert.ok(responses.length,'unexpected additional GraphQL request');
  const response=responses.shift();
  if(response instanceof Error) throw response;
  return {ok:true,status:200,json:async()=>response};
 };
}

test('readable current metadata needs no historical request',async()=>{
 const requests=[];
 assert.deepEqual(await readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:moveState(nft)}},
 ],requests)),nft);
 assert.equal(requests.length,1);
});

test('missing current object recovers the exact sold object from its transaction output',async()=>{
 const requests=[];
 const recovered=await readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:null}},
  {data:transactionPage([{address:'0x'+('1234'.padStart(64,'0')),outputState:moveState(nft),inputState:null}])},
 ],requests));
 assert.deepEqual(recovered,nft);
 assert.equal(requests[1].variables.digest,'saleTx');
 assert.equal(requests[1].variables.cursor,null);
});

test('wrapped or deleted objects recover from the transaction input state',async()=>{
 const recovered=await readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:{asMoveObject:null}}},
  {data:transactionPage([{address:'0x1234',outputState:null,inputState:moveState(nft)}])},
 ]));
 assert.deepEqual(recovered,nft);
});

test('an NFTree missing its number can recover complete historical metadata',async()=>{
 const recovered=await readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:moveState({type:nft.type,json:null})}},
  {data:transactionPage([{address:'0x1234',outputState:moveState(nft)}])},
 ]));
 assert.equal(recovered.json.number,'301');
});

test('historical lookup matches the sold ID, not another NFTree in the same transaction',async()=>{
 const other={type:{repr:'0x111::other::NFT'},json:null};
 const event=await prepareTradeportEvent(sale(),(id,digest)=>readSaleNft(id,digest,mockedGraphql([
  {data:{object:null}},
  {data:transactionPage([
   {address:'0x9999',outputState:moveState(nft)},
   {address:'0x1234',inputState:moveState(other),outputState:null},
  ])},
 ])));
 assert.equal(event,null);
});

test('historical lookup follows opaque cursors until the sold object is found',async()=>{
 const requests=[];
 const recovered=await readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:null}},
  {data:transactionPage([{address:'0x9999',outputState:moveState(nft)}],'opaque-next-page',true)},
  {data:transactionPage([{address:'0x1234',outputState:moveState(nft)}])},
 ],requests));
 assert.deepEqual(recovered,nft);
 assert.equal(requests[2].variables.cursor,'opaque-next-page');
});

test('missing current and historical metadata is explicitly unresolved, never an unrelated sale',async()=>{
 await assert.rejects(readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:null}},
  {data:transactionPage([{address:'0x1234',inputState:null,outputState:null}])},
 ])),error=>error instanceof SaleNftUnavailableError && error.message.includes('0x1234') && error.message.includes('saleTx'));
});

test('provider errors are not reclassified as missing metadata',async()=>{
 for(const responses of [
  [new Error('RPC timeout')],
  [{errors:[{message:'rate limited'}]}],
  [{data:{object:null}},{errors:[{message:'historical store offline'}]}],
 ]){
  await assert.rejects(readSaleNft('0x1234','saleTx',mockedGraphql(responses)),error=>!(error instanceof SaleNftUnavailableError));
 }
});

test('historical pagination that does not advance is a provider error',async()=>{
 await assert.rejects(readSaleNft('0x1234','saleTx',mockedGraphql([
  {data:{object:null}},
  {data:transactionPage([],'same',true)},
  {data:transactionPage([],'same',true)},
 ])),/did not advance/);
});

test('an unresolved sale is durable before scanning later NFTree sales and survives restart',async()=>{
 const type=TRADEPORT_STREAMS[0];
 const state={cursors:{[type]:'baseline'}};
 const missing=sale();missing.contents.json.nft_id='0x111';missing.transaction.digest='missingTx';
 let persisted;let sent=0;
 await pollStream(type,state,{
  query:async()=>({edges:[{cursor:'missing',node:missing},{cursor:'valid',node:sale()}],pageInfo:{endCursor:'valid',hasNextPage:false}}),
  prepare:event=>prepareTradeportEvent(event,async(id,digest)=>{
   if(id==='0x111') throw new SaleNftUnavailableError(id,digest);
   return nft;
  }),
  deferUnresolved:(t,edge,s,options)=>deferTradeportEvent(t,edge,s,{...options,now:()=>1000,log:()=>{}}),
  save:()=>{persisted=JSON.stringify(state);},
  send:async()=>{
   assert.equal(JSON.parse(persisted).pendingTradeportEvents.length,1);
   sent++;
  },
 });
 assert.equal(state.cursors[type],'valid');
 assert.equal(sent,1);
 const restarted=JSON.parse(persisted);
 assert.equal(restarted.pendingTradeportEvents[0].event.transaction.digest,'missingTx');
 await retryDeferredTradeportEvents(restarted,{
  prepare:event=>prepareTradeportEvent(event,async()=>({type:{repr:'0x111::other::NFT'},json:{}})),
  send:async()=>assert.fail('unrelated recovered sale must not notify'),format:eventMessage,
  now:()=>31000,save:()=>{},log:()=>{},
 });
 assert.equal(restarted.pendingTradeportEvents.length,0);
 assert.equal(restarted.cursors[type],'valid');
});

test('failure to persist an unresolved event stops scanning without advancing the cursor',async()=>{
 const type=TRADEPORT_STREAMS[0];const state={cursors:{[type]:'baseline'}};
 await assert.rejects(pollStream(type,state,{
  query:async()=>({edges:[{cursor:'after',node:sale()}],pageInfo:{endCursor:'after',hasNextPage:false}}),
  prepare:async()=>{throw new SaleNftUnavailableError('0x1234','saleTx');},
  deferUnresolved:deferTradeportEvent,send:async()=>assert.fail('send'),
  save:()=>{throw new Error('disk full');},
 }),/disk full/);
 assert.equal(state.cursors[type],'baseline');
 assert.equal(state.pendingTradeportEvents,undefined);
});

test('a transport outage still retains the stream cursor even with deferral enabled',async()=>{
 const type=TRADEPORT_STREAMS[0];const state={cursors:{[type]:'baseline'}};
 await assert.rejects(pollStream(type,state,{
  query:async()=>({edges:[{cursor:'after',node:sale()}],pageInfo:{endCursor:'after',hasNextPage:false}}),
  prepare:async()=>{throw new Error('rate limited');},
  deferUnresolved:deferTradeportEvent,send:async()=>assert.fail('send'),save:()=>assert.fail('save'),
 }),/rate limited/);
 assert.equal(state.cursors[type],'baseline');assert.equal(state.pendingTradeportEvents,undefined);
});
