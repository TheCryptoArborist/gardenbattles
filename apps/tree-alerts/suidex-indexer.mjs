import {norm,TREE,SUI} from './core.mjs';
export function parseIndexer(tokens,v2,v3){
 if(!tokens?.success||!Array.isArray(tokens.data)||!Array.isArray(v2?.items)||!Array.isArray(v3))throw Error('Invalid SuiDex indexer response');
 const prices=new Map(tokens.data.filter(t=>Number(t.priceUsd)>0).map(t=>[norm(t.coinType),Number(t.priceUsd)]));
 const pools=[...v2.items.filter(p=>[p.token0Type,p.token1Type].map(norm).includes(norm(TREE))).map(p=>({id:p.pairId,venue:'SuiDex V2',tvl:Number(p.tvlUsd),volume:Number(p.volume24hUsd),updatedAt:Date.parse(p.latestReserves?.updatedAt||'')})),...v3.filter(p=>[p.token_x_type,p.token_y_type].map(norm).includes(norm(TREE))).map(p=>({id:p.pool_id,venue:'SuiDex V3',tvl:Number(p.tvl_usd),volume:Number(p.volume_24h_usd),updatedAt:Date.parse(p.updated_at||'')}))];
 return{prices,pools,treePrice:prices.get(norm(TREE))||null,suiPrice:prices.get(norm(SUI))||null};
}
export function marketSupplement(pairs,reference){
 const valid=p=>p.chainId==='sui'&&norm(p.baseToken?.address)===norm(TREE)&&Number(p.priceUsd)>0;
 const ordered=[reference,...pairs.filter(valid).sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))].filter(p=>p&&valid(p));
 const cap=ordered.find(p=>Number(p.marketCap)>0);
 const change=ordered.find(p=>typeof p.priceChange?.h24==='number'&&Number.isFinite(p.priceChange.h24));
 return{marketCap:cap?Number(cap.marketCap):null,capSource:cap?.dexId||null,pct24:change?change.priceChange.h24:null,changeSource:change?.dexId||null};
}
