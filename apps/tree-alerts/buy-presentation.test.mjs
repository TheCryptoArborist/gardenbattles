import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUY_PUNS,buyThresholds,buyPresentation} from './buy-presentation.mjs';
test('five captions cycle without repeating across the boundary or restart',()=>{
 const captions=Array.from({length:11},(_,i)=>buyPresentation(1,i).quip);
 assert.equal(new Set(captions.slice(0,5)).size,5);
 for(let i=1;i<captions.length;i++)assert.notEqual(captions[i],captions[i-1]);
 assert.equal(buyPresentation(1,JSON.parse(JSON.stringify(7))).quip,BUY_PUNS[2]);
});
test('USD tiers include exact thresholds and unknown values remain standard',()=>{
 for(const value of [null,undefined,NaN,Infinity,'100',-1,0,9.99])assert.equal(buyPresentation(value).graphic,'buy');
 assert.equal(buyPresentation(10).graphic,'buyLarge');assert.equal(buyPresentation(49.99).graphic,'buyLarge');assert.equal(buyPresentation(50).graphic,'buyHuge');
});
test('configuration validates thresholds before monitoring starts',()=>{
 assert.deepEqual(buyThresholds({TREE_LARGE_BUY_USD:'20',TREE_HUGE_BUY_USD:'100'}),{large:20,huge:100});
 for(const huge of ['nope','0','5'])assert.throws(()=>buyThresholds({TREE_HUGE_BUY_USD:huge}));
 assert.throws(()=>buyPresentation(1,-1));
});
