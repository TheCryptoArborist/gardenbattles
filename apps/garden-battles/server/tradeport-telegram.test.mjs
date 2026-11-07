import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRADEPORT_STREAMS, prepareTradeportEvent, readSaleNft} from './tradeport-telegram.mjs';
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
