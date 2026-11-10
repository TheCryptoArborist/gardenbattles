import {buyThresholds,buyPresentation} from './buy-presentation.mjs';
import {parseIndexer,marketSupplement} from './suidex-indexer.mjs';
import {compact,usd,balances,coinUSD,treeValue,growthBar,alertButtons} from './rich-alerts.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {TREE,SUI,USDC,SEEDS,PACKAGES,norm,poolInfo,classify,analyze,units,periods,recordFlags,priceStep,chooseMarket,estimateBuyUSD} from './core.mjs';
const env=process.env;
const purchaseThresholds=buyThresholds(env);
const enabled=env.TELEGRAM_ENABLED==='true'&&env.DRY_RUN==='false';
const endpoint=env.SUI_GRAPHQL_URL||'https://graphql.mainnet.sui.io/graphql';
const dir=env.RAILWAY_VOLUME_MOUNT_PATH||env.DATA_DIR||'/data';mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(dir+'/tree-alerts.sqlite');db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY,v TEXT NOT NULL); CREATE TABLE IF NOT EXISTS seen(digest TEXT PRIMARY KEY,at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS buys(digest TEXT PRIMARY KEY,time INTEGER NOT NULL,day TEXT NOT NULL,week TEXT NOT NULL,usd REAL); CREATE TABLE IF NOT EXISTS outbox(k TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,message_id INTEGER);');
const get=(k,f=null)=>{const r=db.prepare('SELECT v FROM kv WHERE k=?').get(k);return r?JSON.parse(r.v):f;};
const put=(k,v)=>db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k,JSON.stringify(v));
const log=(event,data={})=>console.log(JSON.stringify({event,...data}));
let health={ready:false,mode:enabled?'live':'dry-run',pools:0,lastPoll:null,lastError:null};
createServer((req,res)=>{if(req.url!=='/health'){res.writeHead(404);res.end();return;}res.writeHead(health.ready?200:503,{'content-type':'application/json'});res.end(JSON.stringify(health));}).listen(Number(env.PORT||3000),'0.0.0.0');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,options={}){
 let response;try{response=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});}catch{throw Error('Remote request failed or timed out');}
 let result;try{result=await response.json();}catch{throw Error('Remote service returned invalid JSON');}
 if(!response.ok)throw Error('Remote service HTTP '+response.status);
 return result;
}
async function gql(query,variables={}){const r=await request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables})});if(r.errors?.length)throw Error('GraphQL: '+r.errors[0].message);if(!r.data)throw Error('Empty GraphQL data');return r.data;}
const pools=new Map(),meta=new Map();
async function metadata(coin){coin=norm(coin);if(meta.has(coin))return meta.get(coin);const saved=get('meta:'+coin);if(saved){meta.set(coin,saved);return saved;}const r=await gql('query($coin:String!){coinMetadata(coinType:$coin){decimals symbol}}',{coin});const m=r.coinMetadata;if(!m||!Number.isInteger(m.decimals))throw Error('Missing coin metadata for '+coin);m.symbol=String(m.symbol).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,24)||'TOKEN';meta.set(coin,m);put('meta:'+coin,m);return m;}
async function loadPool(id){
 if(pools.has(id))return pools.get(id);
 const r=await gql('query($id:SuiAddress!){object(address:$id){asMoveObject{contents{type{repr}}}}}',{id});const type=r.object?.asMoveObject?.contents?.type?.repr;
 const p=type?poolInfo(id,type):null;if(!p)return null;
 for(const coin of p.coins)await metadata(coin);
 pools.set(id,p);put('pool:'+id,p);return p;
}
async function fetchMarket(){
 const r=await request('https://api.dexscreener.com/latest/dex/tokens/'+TREE);if(!Array.isArray(r.pairs))throw Error('Missing market pairs');return r.pairs;
}

let indexerCache=null,indexerAt=0;
async function getIndexer(){
 if(indexerCache&&Date.now()-indexerAt<55000)return indexerCache;
 const [tokens,v2,v3]=await Promise.all(['/api/tokens','/api/pools','/api/v3/pools'].map(path=>request('https://dex.suidex.org'+path)));
 const result=parseIndexer(tokens,v2,v3);indexerCache=result;indexerAt=Date.now();return result;
}

async function discover(){
 const ids=new Set([...SEEDS,...get('poolIds',[])]);let sourceSuccess=0;
 try{const pairs=await fetchMarket();for(const p of pairs)if(['turbos-finance','cetus','suidex'].includes(p.dexId)&&/^0x[0-9a-f]{64}$/.test(p.pairAddress))ids.add(p.pairAddress);sourceSuccess++;}catch(e){log('discovery_warning',{source:'dexscreener',error:e.message});}
 try{const r=await request('https://dex.suidex.org/api/v3/pools');if(!Array.isArray(r))throw Error('Missing SuiDex pools');for(const p of r)if([p.token_x_type,p.token_y_type].map(norm).includes(norm(TREE)))ids.add(p.pool_id);sourceSuccess++;}catch(e){log('discovery_warning',{source:'suidex-v3',error:e.message});}
 try{const idx=await getIndexer();for(const p of idx.pools)ids.add(p.id);sourceSuccess++;}catch(e){log('discovery_warning',{source:'suidex-indexer',error:e.message});}
 for(const id of ids){if(!/^0x[0-9a-f]{64}$/.test(id))continue;try{await loadPool(id);}catch(e){if(SEEDS.includes(id))throw e;log('discovery_warning',{pool:id,error:e.message});}}
 put('poolIds',[...pools.keys()]);health.pools=pools.size;log('pool_discovery',{pools:[...pools.values()].map(p=>({venue:p.venue,id:p.id})),sources:sourceSuccess});
 if(!SEEDS.every(id=>pools.has(id)))throw Error('A required TREE pool is missing');
}
const FACTORIES=[
 '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::factory::PairCreated',
 '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::create_pool::PoolCreatedEvent',
 '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::factory::CreatePoolEvent',
 '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool_factory::PoolCreatedEvent',
];
async function newPools(){
 for(const type of FACTORIES){
  const saved=get('factory:'+type);const initial=!saved;
  const query=`query($t:String!${initial?'':',$c:String'}){events(${initial?'last:1':'first:50,after:$c'},filter:{type:$t}){edges{cursor node{contents{json} transaction{effects{checkpoint{sequenceNumber}}}}} pageInfo{endCursor hasNextPage}}}`;
  let cursor=saved;
  for(let n=0;n<20;n++){
   const page=(await gql(query,{t:type,c:cursor})).events;
   if(initial){if(!page.pageInfo.endCursor)throw Error('Cannot baseline factory stream');put('factory:'+type,page.pageInfo.endCursor);break;}
   for(const edge of page.edges){const f=edge.node.contents.json;const coinValues=[f.token0,f.token1,f.token_x_type?.name,f.token_y_type?.name,f.coin_type_a,f.coin_type_b].filter(Boolean);
    if(!coinValues.length||coinValues.map(norm).includes(norm(TREE))){const id=f.pair||f.pool||f.pool_id;if(id&&!pools.has(id)){const p=await loadPool(id);if(p){const checkpoint=Number(edge.node.transaction.effects.checkpoint.sequenceNumber);if(!Number.isSafeInteger(checkpoint)||checkpoint<1)throw Error('New pool checkpoint missing');put('fromCheckpoint:'+id,checkpoint-1);put('poolIds',[...pools.keys()]);health.pools=pools.size;log('new_tree_pool',{venue:p.venue,pool:id,checkpoint});}}}
    put('factory:'+type,edge.cursor);
   }
   if(page.pageInfo.endCursor)put('factory:'+type,page.pageInfo.endCursor);
   if(!page.pageInfo.hasNextPage)break;cursor=page.pageInfo.endCursor;
  }
 }
}

// Resolve only a verified, unexpired SuiNS reverse name. Names never block alerts.
const names=new Map();async function nameFor(wallet){
 const cached=names.get(wallet);if(cached&&cached.until>Date.now())return cached.name;
 let name=null;try{const r=await gql('query($a:SuiAddress!){address(address:$a){defaultNameRecord{domain target{address} contents{json}}}}',{a:wallet});const n=r.address?.defaultNameRecord;if(n&&norm(n.target?.address)===norm(wallet)&&/^(?:[a-z0-9-]+\.)+sui$/i.test(n.domain)&&Number(n.contents?.json?.expiration_timestamp_ms)>Date.now())name=n.domain;}catch{}
 names.set(wallet,{name,until:Date.now()+300000});if(names.size>1000)names.delete(names.keys().next().value);return name;
}
async function tg(method,payload,form=false){
 const token=env.TELEGRAM_BOT_TOKEN;if(!token)throw Error('TELEGRAM_BOT_TOKEN is missing');
 let response,r;try{response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',signal:AbortSignal.timeout(25000),...(form?{body:payload}:{headers:{'content-type':'application/json'},body:JSON.stringify(payload)})});r=await response.json();}catch{throw Error('Telegram response unavailable; delivery may be uncertain');}
 if(!r.ok){const e=Error('Telegram '+r.error_code+': '+String(r.description||'request rejected'));e.rejected=true;throw e;}return r.result;
}

let chatId=null;
async function verifyTelegram(){const me=await tg('getMe',{});if(me.username!==env.TELEGRAM_EXPECTED_BOT_USERNAME)throw Error('Configured token belongs to a different bot');const chat=await tg('getChat',{chat_id:env.TELEGRAM_CHAT_ID});if(env.TELEGRAM_MESSAGE_THREAD_ID&&(!chat.is_forum||chat.type!=='supergroup'))throw Error('Destination is not a forum group');chatId=chat.id;log('telegram_verified',{bot:me.username,chatId,forum:!!chat.is_forum,topic:Number(env.TELEGRAM_MESSAGE_THREAD_ID)||null});}

const ALERT_QUIPS={
 buy:["Someone just turned over a new leaf. 🌿","A fresh branch joins the TREE family. 🌳","This wallet just put down roots. 🌱","Another buyer branching into TREE. 🍃"],
 liquidity:["Now that’s what we call liquid roots. 💧","A little more water for the money tree. 🌳","Fresh liquidity. Stronger roots. 🌱","Someone’s watering the TREE pool. 💦"],
 up10:["TREE is branching out—10% higher in 24 hours. 🌿","Leafing yesterday’s price behind. 🍃","The canopy just climbed another level. 🌳"],
 up20:["That’s some serious trunk strength—20% up in 24 hours. 🌳","TREE just raised the canopy. 🚀","Looks like TREE found its growth spurt. 🌿"],
 daily:["Tree-mendous! Today’s biggest buy just took root. 🏆","A new daily branch-mark has been set. 🌳","That buy just topped today’s canopy. 🍃"],
 weekly:["A Tree-mendous buy—the biggest branch on this week’s TREE. 👑","This week’s buy record just got uprooted. 🌳","A new heavyweight in the weekly grove. 🏆"]
};
function alertQuip(kind,key){const options=ALERT_QUIPS[kind]||ALERT_QUIPS.buy;let hash=0;for(const c of String(key))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;return options[hash%options.length];}

const assets=Object.fromEntries(['buy','buyLarge','buyHuge','liquidity','up10','up20','daily','weekly'].map(k=>[k,readFileSync(new URL('./graphics/'+k+'.b64',import.meta.url),'utf8')]));
async function deliver(key,payload,{force=false}={}){
 if(!enabled&&!force){log('dry_run_alert',{key,kind:payload.graphic,text:payload.text});return;}
 let row=db.prepare('SELECT * FROM outbox WHERE k=?').get(key);
 if(row?.status==='sent')return;
 if(row)payload=JSON.parse(row.payload);
 if(row?.status==='sending'||row?.status==='uncertain')throw Error('An alert has uncertain delivery; manual review required');
 if(!row){db.prepare('INSERT INTO outbox(k,payload,status) VALUES(?,?,?)').run(key,JSON.stringify(payload),'pending');row={status:'pending'};}
 db.prepare('UPDATE outbox SET status=? WHERE k=?').run('sending',key);
 const form=new FormData();form.set('chat_id',String(chatId));if(env.TELEGRAM_MESSAGE_THREAD_ID)form.set('message_thread_id',env.TELEGRAM_MESSAGE_THREAD_ID);form.set('caption',payload.text.slice(0,1024));form.set('photo',new Blob([Buffer.from(assets[payload.graphic]||assets.buy,'base64')],{type:'image/jpeg'}),'tree-'+payload.graphic+'.jpg');form.set('reply_markup',JSON.stringify(alertButtons(payload.tx)));
 try{const message=await tg('sendPhoto',form,true);db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE outbox SET status=?,message_id=? WHERE k=?').run('sent',message.message_id,key);if(Number.isSafeInteger(payload.captionIndex))put('buyCaptionIndex',payload.captionIndex+1);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}if(env.TELEGRAM_MESSAGE_THREAD_ID&&message.message_thread_id!==Number(env.TELEGRAM_MESSAGE_THREAD_ID))throw Error('Telegram delivered to an unexpected topic');log('telegram_delivered',{key,messageId:message.message_id,topic:message.message_thread_id,kind:payload.graphic});}
 catch(e){db.prepare("UPDATE outbox SET status=? WHERE k=? AND status!='sent'").run(e.rejected?'pending':'uncertain',key);throw e;}
 await sleep(1200);
}
async function transactionEvents(tx){let page=tx.effects.events;const nodes=[...page.nodes];while(page.pageInfo?.hasNextPage){const r=await gql('query($d:String!,$c:String){transaction(digest:$d){effects{events(first:50,after:$c){nodes{contents{type{repr} json}} pageInfo{endCursor hasNextPage}}}}}',{d:tx.digest,c:page.pageInfo.endCursor});page=r.transaction.effects.events;nodes.push(...page.nodes);}tx.effects.events.nodes=nodes;return tx;}
async function pagePool(id,cursor,initial=false){
 const from=get('fromCheckpoint:'+id);
 const query=`query($id:SuiAddress!${initial?'':',$c:String'}${from!==null?', $cp:UInt53':''}){transactions(${initial?'last:1':'first:5,after:$c'},filter:{affectedObject:$id${from!==null?',afterCheckpoint:$cp':''}}){edges{cursor node{digest sender{address} effects{status timestamp events(first:20){nodes{contents{type{repr} json}} pageInfo{endCursor hasNextPage}}}}} pageInfo{endCursor hasNextPage}}}`;
 return(await gql(query,{id,c:cursor,cp:from})).transactions;
}
let quote=null;
function marketLines(snapshot=quote,now=Date.now()){
 if(!snapshot||now-snapshot.at>180000)return ['Token price: temporarily unavailable','Market cap: temporarily unavailable'];
 const price=Number(snapshot.price),cap=Number(snapshot.marketCap);
 return ['Token price: '+(Number.isFinite(price)&&price>0?'$'+price.toFixed(8):'unavailable'),
 'Market cap: '+(Number.isFinite(cap)&&cap>0?usd(cap):'unavailable'),
 '24h change: '+(Number.isFinite(snapshot.pct24)?(snapshot.pct24>=0?'+':'')+snapshot.pct24.toFixed(2)+'%':'unavailable'),
 'Sources: price '+snapshot.priceSource+'; cap '+(snapshot.capSource||'unavailable')+'; 24h '+(snapshot.changeSource||'unavailable')];
}
async function labelAmount(coin,amount){const m=await metadata(coin);return units(amount,m.decimals)+' '+(norm(coin)===norm(TREE)?'TREE':m.symbol);}

async function poolSnapshot(id){
 const p=pools.get(id);if(!p)return null;
 try{
  const r=await gql('query($id:SuiAddress!){object(address:$id){asMoveObject{contents{json}}}}',{id});
  const raw=balances(p.venue,r.object?.asMoveObject?.contents?.json||{});
  let total=0,valued=true;const parts=[];
  for(let i=0;i<2;i++){const m=await metadata(p.coins[i]),n=Number(raw[i])/10**m.decimals,price=coinUSD(p.coins[i],quote);
   parts.push(compact(n)+' '+(p.coins[i]===norm(TREE)?'TREE':m.symbol));if(price===null)valued=false;else total+=n*price;}
  const indexed=indexerCache&&Date.now()-indexerAt<=180000?indexerCache.pools.find(x=>x.id===id&&Number.isFinite(x.updatedAt)&&Date.now()-x.updatedAt<=300000):null;
  const tvl=indexed&&Number.isFinite(indexed.tvl)&&indexed.tvl>=0?indexed.tvl:null;
  return '💧 '+p.venue+' pool: '+parts.join(' | ')+(tvl!==null?' | ~'+usd(tvl)+' total (SuiDex indexer)':valued?' | ~'+usd(total)+' total':' | USD total unavailable')+(indexed&&Number.isFinite(indexed.volume)?' | 24h vol '+usd(indexed.volume):'');
 }catch(e){log('pool_snapshot_warning',{pool:id,error:e.message});return '💧 '+p.venue+' pool snapshot unavailable';}
}

async function processTx(tx){
 if(db.prepare('SELECT 1 FROM seen WHERE digest=?').get(tx.digest))return;
 await transactionEvents(tx);
 // Load other pools touched by this transaction so routed swaps are counted once.
 for(const e of tx.effects.events.nodes){const f=e.contents.json;const pkg=e.contents.type.repr.split('::')[0];if(PACKAGES[pkg]&&(f.pool||f.pool_id))await loadPool(f.pool||f.pool_id);}
 const a=analyze(tx,pools);if(!a){db.prepare('INSERT OR IGNORE INTO seen VALUES(?,?)').run(tx.digest,Date.now());return;}
 let value=null,flags={daily:false,weekly:false},period=periods(a.time);
 if(a.buy){value=estimateBuyUSD(a.buy,meta,quote,a.time,Date.now());const prev={dayCount:db.prepare('SELECT COUNT(*) n FROM buys WHERE day=? AND usd>0').get(period.day).n,weekCount:db.prepare('SELECT COUNT(*) n FROM buys WHERE week=? AND usd>0').get(period.week).n,dayMax:db.prepare('SELECT COALESCE(MAX(usd),0) n FROM buys WHERE day=?').get(period.day).n,weekMax:db.prepare('SELECT COALESCE(MAX(usd),0) n FROM buys WHERE week=?').get(period.week).n};flags=recordFlags(prev,value);}
 const person=await nameFor(a.wallet)||(a.wallet.slice(0,6)+'…'+a.wallet.slice(-4));
 const presentation=a.buy?buyPresentation(value,get('buyCaptionIndex',0),purchaseThresholds):null;
 const graphic=presentation?.graphic||'liquidity';
 const lines=[flags.weekly?'👑 LARGEST BUY THIS WEEK':flags.daily?'🏆 LARGEST BUY TODAY':a.buy?presentation.heading:'💧 LIQUIDITY ADDED',''];
 if(a.buy){lines.push('Purchased: '+await labelAmount(TREE,a.buy.tree));const spent=await Promise.all(a.buy.spent.map(([c,v])=>labelAmount(c,v)));lines.push('Spent: '+spent.join(' + '),'Exchange: '+a.buy.venues.join(' + '));if(value)lines.push('Spent value: ~'+usd(value));const received=treeValue(a.buy.tree,(await metadata(TREE)).decimals,quote);if(received!==null)lines.push('TREE received value: ~'+usd(received));if(flags.daily&&flags.weekly)lines.push('🏆 Also the largest buy today');}
 if(a.deposits.length){if(a.buy)lines.push('','💧 Liquidity added in the same transaction');for(const d of a.deposits){lines.push(d.venue+': '+(await Promise.all(d.coins.map((c,i)=>labelAmount(c,d.amounts[i])))).join(' + '));}}
 lines.push('',...marketLines());
 const touched=[...new Set(tx.effects.events.nodes.map(e=>classify(e.contents,pools)).filter(Boolean).map(e=>e.pool))];
 for(const id of touched.slice(0,3)){const info=await poolSnapshot(id);if(info)lines.push(info);}
 if(touched.length>3)lines.push('Additional pools: '+(touched.length-3)+' (see TX)');
 lines.push('Current snapshots; USD values estimated.');
 if(a.buy){const bar=growthBar(value);if(bar)lines.push('',bar);}
 lines.push('',(a.buy?'Buyer':'Provider')+': '+person);
 if(flags.daily||flags.weekly)lines.push('Record among USD-valued buys observed since monitoring began. Central Time; week starts Monday.');
 lines.push('','www.tree-token.xyz');
 lines.splice(1,0,presentation?.quip||alertQuip(graphic,a.digest));
 const payload={graphic,text:lines.join('\n'),tx:a.digest,...(presentation?{captionIndex:presentation.captionIndex}:{})};
 await deliver('tx:'+a.digest,payload);
 db.exec('BEGIN IMMEDIATE');try{if(a.buy)db.prepare('INSERT OR IGNORE INTO buys VALUES(?,?,?,?,?)').run(a.digest,a.time,period.day,period.week,value);db.prepare('INSERT OR IGNORE INTO seen VALUES(?,?)').run(tx.digest,Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 log('transaction_processed',{digest:a.digest,buy:!!a.buy,liquidity:a.deposits.length,record:flags,usd:value});
}
async function poll(){
 const batches=[];
 for(const p of pools.values()){
  const cursor=get('cursor:'+p.id);
  if(!cursor&&get('fromCheckpoint:'+p.id)===null){const page=await pagePool(p.id,null,true);if(!page.pageInfo.endCursor)throw Error('Cannot baseline pool '+p.id);put('cursor:'+p.id,page.pageInfo.endCursor);log('pool_baselined',{venue:p.venue,pool:p.id});continue;}
  let c=cursor;for(let n=0;n<40;n++){const page=await pagePool(p.id,c);batches.push({id:p.id,page});if(!page.pageInfo.hasNextPage)break;if(!page.pageInfo.endCursor||page.pageInfo.endCursor===c)throw Error('Pool cursor did not advance');c=page.pageInfo.endCursor;if(n===39)log('backlog_warning',{pool:p.id});}
 }
 const transactions=new Map();for(const b of batches)for(const edge of b.page.edges)transactions.set(edge.node.digest,edge.node);
 for(const tx of [...transactions.values()].sort((a,b)=>Date.parse(a.effects.timestamp)-Date.parse(b.effects.timestamp)))await processTx(tx);
 // Commit pool cursors only when every transaction in the batch is processed.
 for(const b of batches)if(b.page.pageInfo.endCursor)put('cursor:'+b.id,b.page.pageInfo.endCursor);
 health.lastPoll=new Date().toISOString();
}
async function market(){

 let pairs=[],idx=null;
 try{idx=await getIndexer();}catch(e){log('indexer_warning',{error:e.message});}
 try{pairs=await fetchMarket();}catch(e){log('market_supplement_warning',{error:e.message});}
 let source=get('priceSource');
 if(!source){const selected=chooseMarket(pairs);if(selected){source=selected.pairAddress;put('priceSource',source);}}
 const p=pairs.find(p=>p.pairAddress===source);
 const now=Date.now(),pct=typeof p?.priceChange?.h24==='number'?p.priceChange.h24:NaN;
 const supplement=marketSupplement(pairs,p);
 const price=idx?.treePrice||(Number(p?.priceUsd)>0?Number(p.priceUsd):null),native=Number(p?.priceNative);
 if(!(price>0))throw Error('TREE price unavailable from both sources');
 quote={at:now,...supplement,priceSource:idx?.treePrice?'SuiDex indexer':'Dexscreener '+p.dexId,
 suiUSD:idx?.suiPrice||(native>0&&norm(p?.quoteToken?.address)===norm(SUI)?Number(p.priceUsd)/native:null),price};
 log('market_snapshot',{priceSource:quote.priceSource,marketCap:quote.marketCap,capSource:quote.capSource,pct24:quote.pct24,changeSource:quote.changeSource});
 // Keep milestone history pinned to its existing reference pool.
 if(!p||Number(p.liquidity?.usd)<1000)return;
 // Require 3 consecutive valid samples at least one minute apart and $50 daily volume.
 const prior=get('priceSamples',[]).filter(s=>now-s.at<=600000);if(!prior.length||now-prior.at(-1).at>=55000)prior.push({at:now,pct});put('priceSamples',prior.slice(-3));
 if(prior.length<3||prior.at(-1).at-prior[0].at<110000||!Number.isFinite(pct)||Number(p.volume?.h24)<50)return;
 const confirmed=Math.min(...prior.map(s=>s.pct));if(!Number.isFinite(confirmed))return;
 const old=get('priceMilestones',{}),step=priceStep(old,confirmed,now);
 if(step.hit){await deliver('price:'+step.hit+':'+now,{graphic:step.hit===20?'up20':'up10',text:`${step.hit===20?'🚀':'📈'} TREE UP ${step.hit}%\n${alertQuip(step.hit===20?'up20':'up10',now)}\n\n24-hour change: +${pct.toFixed(2)}%\n${marketLines().join('\n')}\nSource: Dexscreener · ${p.dexId}\nReference pool: ${p.pairAddress}\n\nConfirmed across three samples.\nwww.tree-token.xyz`});}
 put('priceMilestones',step.state);
}
async function main(){
 if(get('startedAt')===null)put('startedAt',new Date().toISOString());
 await discover();await newPools();
 if(env.TELEGRAM_BOT_TOKEN){await verifyTelegram();if(env.SEND_SETUP_TEST==='true')await deliver('setup-test-v1',{graphic:'buy',text:'🌳 TREE ALERTS — SETUP TEST\n\n@TreeGatekeeperBot is connected to this topic.\nPrepared: TREE buys, liquidity deposits, +10% / +20% price milestones, and daily / weekly buy records.\n\nThis is a connection test, not a purchase.\nwww.tree-token.xyz'},{force:true});}


 if(chatId){
  for(const [tier,example,index] of [['standard',1,0],['large',purchaseThresholds.large,1],['huge',purchaseThresholds.huge,2]]){
   const preview=buyPresentation(example,index,purchaseThresholds);
   await deliver('approved-buy-tier-preview-20261110:'+tier,{
    graphic:preview.graphic,
    text:'🧪 TEST — '+preview.heading+'\n'+preview.quip+'\n\nArtwork tier: '+tier+'\nExample purchase value: '+usd(example)+' (demonstration only)\n\nTEST PREVIEW — no actual purchase occurred.\nwww.tree-token.xyz'
   },{force:true});
  }
 }

 if(env.TEST_NOTIFICATION_BATCH&&chatId){
  const batch=env.TEST_NOTIFICATION_BATCH;
  try{await market();}catch(e){log('test_market_warning',{error:e.message});}
  const fresh=quote&&Date.now()-quote.at<=180000;
  const amount=fresh&&quote.suiUSD>0?3*quote.suiUSD:null;
  const treeEstimate=amount&&quote.price>0?amount/quote.price:null;
  const sample=treeEstimate?compact(treeEstimate)+' TREE':'100,000 TREE (example)';
  const snapshot=await poolSnapshot(SEEDS[0]);
  const buyLines=['🧪 TEST — TREE BUY ALERT','Tree-mendous! This wallet just put down roots. 🌱','',
   '💰 Example spent: 3 SUI'+(amount?' (~'+usd(amount)+')':''),
   '🌳 Example received: '+sample+(amount?' (~'+usd(amount)+')':''),
   'Exchange example: SuiDex V2','',...marketLines(),'',snapshot||'Pool snapshot unavailable',
   'Current pool snapshot; USD values estimated.','',growthBar(amount)||'🌳 Example purchase',
   'Buyer: demonstration only','','TEST DATA — no actual purchase occurred.','www.tree-token.xyz'];
  await deliver('manual-test:'+batch+':buy',{graphic:'buy',text:buyLines.join('\n')},{force:true});
  const lpLines=['🧪 TEST — LIQUIDITY ADDED','Now that’s what we call liquid roots. 💧','',
   'Example deposit: '+sample+' + 3 SUI','Exchange example: SuiDex V2','',...marketLines(),'',snapshot||'Pool snapshot unavailable',
   'Current pool snapshot; USD values estimated.','','Provider: demonstration only',
   'TEST DATA — no actual deposit occurred.','www.tree-token.xyz'];
  await deliver('manual-test:'+batch+':liquidity',{graphic:'liquidity',text:lpLines.join('\n')},{force:true});
 }

 if(enabled&&!chatId)throw Error('Live mode needs verified Telegram settings');
 try{await market();}catch(e){log('price_warning',{error:e.message});}await poll();health.ready=true;health.lastError=null;log('watcher_ready',{mode:health.mode,pools:pools.size,startedAt:get('startedAt')});
 let cycle=0;while(true){await sleep(30000);try{await newPools();if(cycle%20===0)await discover();if(cycle%2===0)try{await market();}catch(e){log('price_warning',{error:e.message});}await poll();health.ready=true;health.lastError=null;cycle++;}catch(e){health.ready=false;health.lastError=e.message;log('watcher_error',{error:e.message});}}
}
main().catch(e=>{health.lastError=e.message;log('startup_failed',{error:e.message});setTimeout(()=>process.exit(1),2000);});
