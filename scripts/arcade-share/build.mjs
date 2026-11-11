// Build a narrowly patched ending UI from the current embedded browser bundle.
// Every byte outside these three result-component insertions is preserved.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const source=path.resolve(process.argv[2]),shared=path.resolve(process.argv[3]),out=path.resolve('dist/arcade-share');fs.mkdirSync(out,{recursive:true});const report={};
for(const name of ['index-tree-lock-v16.js','garden-bot-same-origin-preview.js','pvp-mobile-preview.js']){
 const original=fs.readFileSync(path.join(source,name),'utf8');let code=original;const edits=[];
 const patch=(a,b)=>{assert.equal(code.split(a).length,2,'Result UI anchor changed in '+name);code=code.replace(a,b);edits.push([a,b]);};
 patch('function TY({open:e,title:t,','function TY({open:e,arcadeRun=null,title:t,');
 patch('a.jsx(TY,{open:NP,title:O1,','a.jsx(TY,{open:NP,arcadeRun:!K&&!yP&&(R?.finished||R?.winner)?{gameId:Ye?"garden-bot":"pvp",runId:R.battleId,wallet:n,ready:true}:null,title:O1,');
 patch('a.jsx("p",{className:"gb-result-modal-summary",children:r}),','a.jsx("p",{className:"gb-result-modal-summary",children:r}),arcadeRun&&a.jsx(ArcadeEndSharePrompt,{React:p,...arcadeRun}),');
 let restored=code;for(const [a,b]of edits.reverse())restored=restored.replace(b,a);assert.equal(restored,original,'Unexpected wallet/payment/gameplay changes');
 code='import{EndSharePrompt as ArcadeEndSharePrompt}from"./arcade-end-share-prompt.js";\n'+code;fs.writeFileSync(path.join(out,name),code);
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex');report[name]={baseline:hash(original),output:hash(code),scope:'Result modal only'};
}
for(const name of ['arcade-share-handoff.js','arcade-end-share-prompt.js','arcade-result-share-builder.js'])fs.copyFileSync(path.join(shared,name),path.join(out,name));
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
// Update historical snapshot tests to normalize only these approved insertions.
const testOut=path.join(out,'test');fs.mkdirSync(testOut,{recursive:true});
fs.copyFileSync('scripts/arcade-share/normalize.mjs',path.join(testOut,'arcade-share-normalize.mjs'));
for(const name of ['pvp-mobile-preview.test.mjs','tree-lock-fifth-proof-release.test.mjs']){
 let code=fs.readFileSync(path.resolve(source,'../../../test',name),'utf8');
 code='import {beforeArcadeHandoff} from "./arcade-share-normalize.mjs";\n'+code;
 if(name==='pvp-mobile-preview.test.mjs'){
  code=code.replace('const original = read("public/battle/assets/index-tree-lock-v16.js");','const original = beforeArcadeHandoff(read("public/battle/assets/index-tree-lock-v16.js"));').replace('const preview = read("public/battle/assets/pvp-mobile-preview.js");','const preview = beforeArcadeHandoff(read("public/battle/assets/pvp-mobile-preview.js"));').replace('read("public/battle/assets/garden-bot-same-origin-preview.js"))','beforeArcadeHandoff(read("public/battle/assets/garden-bot-same-origin-preview.js")))');
 }else code=code.replace('const read = name => readFileSync("public/battle/assets/" + name, "utf8");','const read = name => beforeArcadeHandoff(readFileSync("public/battle/assets/" + name, "utf8"));');
 fs.writeFileSync(path.join(testOut,name),code);
}
