import assert from 'node:assert/strict';
import {revealStep,revealSettled,revealShape} from '../web/design/handbook-lab/contents-glass-entry.mjs';
const results=[];const test=(name,fn)=>{fn();results.push(name);};
test('entrance-expands-through-intermediates-and-small-overshoot',()=>{
 let s={value:0,velocity:0};const values=[];for(let i=0;i<100;i++){s=revealStep(s,1,1/144);values.push(s.value);}
 assert(values.filter(x=>x>.1&&x<.9).length>5);assert(Math.max(...values)>1.01&&Math.max(...values)<1.06);assert(revealSettled(s));
});
test('reversal-keeps-position-and-velocity-instead-of-restarting',()=>{
 let s={value:0,velocity:0};for(let i=0;i<8;i++)s=revealStep(s,1,1/144);
 const same=revealStep(s,0,0);assert.deepEqual(same,s);const reverse=revealStep(s,0,1/144);assert(Math.abs(reverse.value-s.value)<.1);assert.notEqual(reverse.value,0);
});
test('long-callback-gaps-do-not-skip-the-whole-entrance',()=>{assert.deepEqual(revealStep({value:0,velocity:0},1,2),revealStep({value:0,velocity:0},1,.04));});
test('reduced-motion-reaches-usable-static-state-immediately',()=>{assert.deepEqual(revealStep({value:.3,velocity:2},1,.01,true),{value:1,velocity:0});});
test('surface-expands-around-same-ink-without-mutating-text-layout',()=>{
 const aim={x:8,y:20,w:200,h:44},copy={...aim},small=revealShape(aim,0),full=revealShape(aim,1);
 assert.equal(small.x+small.w/2,aim.x+aim.w/2);assert.equal(small.y+small.h/2,aim.y+aim.h/2);assert.deepEqual(full,{...aim,opacity:1});assert.deepEqual(aim,copy);
});
console.log(JSON.stringify({status:'pass',cases:results},null,2));
