export const BUY_PUNS=Object.freeze([
 '🌱 Another wallet just put down roots!',
 '🌳 Tree-mendous choice. Welcome to the grove!',
 '🍃 Someone’s branching into TREE!',
 '🌿 Fresh TREE. Stronger roots.',
 '🪵 Knock on wood—another TREE buy!',
]);
export function buyThresholds(env={}){
 const large=Number(env.TREE_LARGE_BUY_USD??10),huge=Number(env.TREE_HUGE_BUY_USD??50);
 if(!Number.isFinite(large)||!Number.isFinite(huge)||large<=0||huge<=large)throw Error('TREE buy thresholds must be positive and increasing');
 return {large,huge};
}
export function buyPresentation(value,index=0,thresholds=buyThresholds()){
 if(!Number.isSafeInteger(index)||index<0)throw Error('Invalid saved buy caption index');
 const known=typeof value==='number'&&Number.isFinite(value)&&value>0;
 const graphic=known&&value>=thresholds.huge?'buyHuge':known&&value>=thresholds.large?'buyLarge':'buy';
 return {graphic,heading:graphic==='buyHuge'?'🌳 BIG ROOT ENERGY!':graphic==='buyLarge'?'🌳 TREE-MENDOUS BUY!':'🌳 TREE BUY ALERT',quip:BUY_PUNS[index%BUY_PUNS.length],captionIndex:index};
}
