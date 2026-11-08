import {norm,TREE,SUI,USDC} from './core.mjs';
export function compact(n){if(!Number.isFinite(n))return 'unavailable';for(const [size,suffix] of [[1e9,'B'],[1e6,'M'],[1e3,'K']])if(Math.abs(n)>=size)return(n/size).toFixed(2).replace(/\.?0+$/,'')+suffix;return n.toLocaleString('en-US',{maximumFractionDigits:2});}
export function usd(n){return Number.isFinite(n)&&n>=0?'$'+compact(n):'unavailable';}
export function balances(venue,f){const keys=venue==='SuiDex V2'?['reserve0','reserve1']:venue==='SuiDex V3'?['reserve_x','reserve_y']:['coin_a','coin_b'];return keys.map(k=>{const v=f[k];if(!/^\d+$/.test(String(v)))throw Error('Pool balance unavailable');return BigInt(v);});}
export function coinUSD(coin,q,now=Date.now()){if(!q||now-q.at>180000)return null;coin=norm(coin);const v=coin===norm(TREE)?q.price:coin===norm(SUI)?q.suiUSD:coin===norm(USDC)?1:null;return Number.isFinite(v)&&v>0?v:null;}
export function treeValue(raw,decimals,q,now=Date.now()){const p=coinUSD(TREE,q,now);return p===null?null:Number(raw)/10**decimals*p;}
export function growthBar(value){if(!Number.isFinite(value)||value<=0)return null;return '🌳'.repeat(Math.min(10,Math.max(1,Math.ceil(Math.log10(1+value)*3))))+' '+usd(value)+' buy';}
export function alertButtons(tx){return{inline_keyboard:[[{text:'🌳 Buy TREE',url:'https://tree-token.xyz/'},{text:'𝕏 Follow TREE',url:'https://x.com/thickquidity'}],[{text:'💬 Telegram',url:'https://t.me/cryptoarborist'},{text:tx?'🔎 View TX':'🌐 Website',url:tx?'https://suiscan.xyz/mainnet/tx/'+tx:'https://tree-token.xyz/'}]]};}
