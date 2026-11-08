export const TREE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const SUI='0x2::sui::SUI';
export const USDC='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const PACKAGES={
 '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a':'SuiDex V2',
 '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56':'SuiDex V3',
 '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb':'Cetus',
 '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1':'Turbos',
};
export const SEEDS=[
 '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc',
 '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf',
 '0xa89656bd7d924271fdc183e54680a75455c7786ee83808fa3adf3e1c09ef344c',
 '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
 '0x2ebaff75b8745896404085babb9ef3a77ccbb6c7d3f4db31626cefff04f7f355',
];
export function norm(type){return String(type).replace(/\s+/g,'').replace(/(^|[<,])(?:0x)?([0-9a-f]{1,64})(?=::)/gi,(_,sep,x)=>sep+'0x'+x.toLowerCase().replace(/^0+(?=.)/,''));}
export function args(type){const start=type.indexOf('<');if(start<0)return[];const s=type.slice(start+1,-1);let depth=0,out=[],last=0;for(let i=0;i<s.length;i++){if(s[i]==='<')depth++;if(s[i]==='>')depth--;if(s[i]===','&&depth===0){out.push(norm(s.slice(last,i)));last=i+1;}}out.push(norm(s.slice(last)));return out;}
export function poolInfo(id,type){const root=type.split('<')[0],p=root.split('::'),venue=PACKAGES[p[0]];const coins=args(type).slice(0,2);if(!venue||!['Pool','Pair'].includes(p[2])||!coins.includes(norm(TREE)))return null;return{id,venue,coins,type};}
const raw=x=>{if(!/^\d+$/.test(String(x)))throw Error('Invalid raw event amount');return BigInt(x);};
const bool=x=>{if(typeof x!=='boolean')throw Error('Invalid swap direction');return x;};
export function classify(contents,pools){
 const type=contents.type.repr,base=type.split('<')[0],parts=base.split('::'),venue=PACKAGES[parts[0]],name=parts.at(-1),f=contents.json;
 if(!venue)return null;
 let p;
 if(venue==='SuiDex V2'){
  const coins=args(type).slice(0,2);if(!coins.includes(norm(TREE)))return null;
  p=[...pools.values()].find(p=>p.venue===venue&&p.coins.join()===coins.join());
 }else p=pools.get(f.pool_id||f.pool);
 if(!p||p.venue!==venue)return null;
 let kind,amounts,input;
 if(venue==='SuiDex V2'){
  if(name==='Swap'){
   const ins=[raw(f.amount0_in),raw(f.amount1_in)],outs=[raw(f.amount0_out),raw(f.amount1_out)];
   const ti=p.coins.indexOf(norm(TREE));const treeNet=outs[ti]-ins[ti];if(treeNet===0n)return null;
   input=treeNet>0n?1-ti:ti;amounts=[ins[0]-outs[0],ins[1]-outs[1]];kind='swap';
  }else if(name==='LPMint'){kind='liquidity';amounts=[raw(f.amount0),raw(f.amount1)];}
  else return null;
 }else if(name==='SwapEvent'){
  kind='swap';
  if(venue==='Cetus'){
   input=bool(f.atob)?0:1;amounts=[0n,0n];amounts[input]=raw(f.amount_in);amounts[1-input]=-raw(f.amount_out);
  }else{
   input=bool(venue==='Turbos'?f.a_to_b:f.x_for_y)?0:1;
   amounts=[raw(venue==='Turbos'?f.amount_a:f.amount_x),raw(venue==='Turbos'?f.amount_b:f.amount_y)];amounts[1-input]=-amounts[1-input];
  }
 }else if((venue==='Turbos'&&name==='MintEvent')||(venue!=='Turbos'&&name==='AddLiquidityEvent')){
  kind='liquidity';amounts=venue==='SuiDex V3'?[raw(f.amount_x),raw(f.amount_y)]:[raw(f.amount_a),raw(f.amount_b)];
 }else return null;
 if(amounts.every(x=>x===0n))return null;
 return{kind,pool:p.id,venue,coins:p.coins,amounts,provider:kind==='liquidity'?(f.sender||f.owner||null):null};
}
export function analyze(tx,pools){
 if(tx.effects?.status!=='SUCCESS')return null;
 const actions=tx.effects.events.nodes.map(e=>classify(e.contents,pools)).filter(Boolean);
 const swaps=actions.filter(a=>a.kind==='swap');const deposits=actions.filter(a=>a.kind==='liquidity');
 let treeNet=0n;const spent=new Map();
 for(const a of swaps)for(let i=0;i<2;i++){const c=a.coins[i],v=a.amounts[i];if(c===norm(TREE))treeNet-=v;else spent.set(c,(spent.get(c)||0n)+v);}
 const buy=treeNet>0n?{tree:treeNet,spent:[...spent].filter(([,v])=>v>0n),venues:[...new Set(swaps.map(a=>a.venue))]}:null;
 if(!buy&&!deposits.length)return null;
 return{digest:tx.digest,time:Date.parse(tx.effects.timestamp),wallet:tx.sender.address,buy,deposits};
}
export function units(value,decimals){value=BigInt(value);const neg=value<0n;if(neg)value=-value;const s=value.toString().padStart(decimals+1,'0');const whole=decimals?s.slice(0,-decimals):s;const frac=decimals?s.slice(-decimals).replace(/0+$/,''):'';return(neg?'-':'')+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(frac?'.'+frac:'');}
export function periods(time){const d=new Date(time);const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));const day=`${parts.year}-${parts.month}-${parts.day}`;const local=new Date(day+'T12:00:00Z');const offset=(local.getUTCDay()+6)%7;local.setUTCDate(local.getUTCDate()-offset);return{day,week:local.toISOString().slice(0,10)};}
export function recordFlags(previous,value){return{daily:Number.isFinite(value)&&value>0&&previous.dayCount>0&&value>previous.dayMax,weekly:Number.isFinite(value)&&value>0&&previous.weekCount>0&&value>previous.weekMax};}
// Hysteresis: rearm below threshold - 3pp, with a six-hour cooldown.
export function priceStep(state,pct,now){
 const s=structuredClone(state||{});const eligible=[];
 for(const threshold of [10,20]){const p=s[threshold]||{armed:true,sentAt:0};if(pct<threshold-3&&now-p.sentAt>=21600000)p.armed=true;if(pct>=threshold&&p.armed&&now-p.sentAt>=21600000)eligible.push(threshold);s[threshold]=p;}
 const hit=eligible.length?Math.max(...eligible):null;
 if(hit)for(const threshold of [10,20])if(threshold<=hit)s[threshold]={armed:false,sentAt:now};
 return{state:s,hit};
}
export function chooseMarket(pairs){
 return pairs.filter(p=>p.chainId==='sui'&&[p.baseToken?.address,p.quoteToken?.address].map(norm).includes(norm(TREE))&&norm(p.baseToken?.address)===norm(TREE)&&Number(p.liquidity?.usd)>=1000&&Number(p.priceUsd)>0).sort((a,b)=>Number(b.liquidity.usd)-Number(a.liquidity.usd))[0]||null;
}
export function estimateBuyUSD(buy,metadata,quote,time,now){
 // Use the observed quote only for fresh transactions, and never mislabel old replays with current USD values.
 if(!buy||!quote||now-time>300000||now-quote.at>180000)return null;
 let value=0;
 for(const [coin,amount] of buy.spent){const m=metadata.get(coin);if(!m)return null;const n=Number(amount)/10**m.decimals;if(coin===norm(USDC))value+=n;else if(coin===norm(SUI)&&quote.suiUSD>0)value+=n*quote.suiUSD;else return null;}
 return value>0?value:null;
}
