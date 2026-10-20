import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emphasisWeights,blendEmphasis} from '../web/design/handbook-lab/contents-glass-emphasis.mjs';
import {contentsMotionProblems} from './contents-glass-motion-checks.mjs';
const rows=[{x:8,y:0,w:180,h:40},{x:8,y:40,w:200,h:60},{x:8,y:100,w:160,h:40}];
const cases=[];function check(name,fn){fn();cases.push(name);}
check('departure-fades-old-weight-before-destination-emphasis',()=>{
  const start=emphasisWeights(rows[0],rows),departed=emphasisWeights({...rows[0],y:8},rows);
  assert.equal(start[0],1);assert.equal(start[1],0);assert(departed[0]>0&&departed[0]<1);assert.equal(departed[1],0);
});
check('arrival-blends-through-intermediate-emphasis',()=>{
  const approaching=emphasisWeights({...rows[1],y:48},rows)[1];assert(approaching>0&&approaching<1);assert.equal(emphasisWeights(rows[1],rows)[1],1);
});
check('ordinary-scroll-weight-is-continuous-and-bounded',()=>{
  let previous=emphasisWeights(rows[0],rows);
  for(let y=.25;y<=100;y+=.25){const next=emphasisWeights({...rows[0],y},rows);for(let i=0;i<next.length;i++){assert(next[i]>=0&&next[i]<=1);assert(Math.abs(next[i]-previous[i])<.03);}previous=next;}
});
check('emphasis-never-mutates-layout-inputs',()=>{const snapshot=JSON.stringify(rows);emphasisWeights(rows[1],rows);assert.equal(JSON.stringify(rows),snapshot);});
check('command-travel-does-not-flash-passing-topics',()=>{assert.deepEqual(emphasisWeights(rows[1],rows,2),[0,0,0]);});
check('emphasis-fades-and-retargets-from-current-paint',()=>{const first=blendEmphasis([1,0],[0,1],1/60);assert(first[0]>0&&first[0]<1);assert(first[1]>0&&first[1]<1);const reversed=blendEmphasis(first,[1,0],1/60);assert(reversed[0]>first[0]&&reversed[0]<1);assert(reversed[1]<first[1]&&reversed[1]>0);});
check('reduced-motion-updates-ink-with-the-settled-pane',()=>{assert.deepEqual(blendEmphasis([1,0],[0,1],1/60,true),[0,1]);});
const reports=[];
const witnesses={wideTravel:false,manualScroll:false,narrowExit:false};
for(const name of process.argv.slice(2)){
  const batches=JSON.parse(await readFile(name,'utf8'));
  for(const batch of batches){
    const moved=batch.frames.some((f,i,a)=>i&&f.shape&&a[i-1].shape&&Math.abs(f.shape.y-a[i-1].shape.y)>.1);
    if(batch.frames[0]?.width>1100&&batch.trigger.type==='pointerdown'&&moved)witnesses.wideTravel=true;
    if(batch.trigger.type==='wheel'&&moved&&batch.frames.some(f=>f.owner?.kind==='scroll'))witnesses.manualScroll=true;
    if(batch.frames[0]?.width<=1100&&batch.trigger.type==='pointerdown'&&batch.trigger.text!=='Contents'&&batch.frames.filter(f=>!f.open&&f.opacity>0).length>=2)witnesses.narrowExit=true;
    const renderedFrames=batch.frames.filter(f=>f.ready&&f.shape).length;
    reports.push({file:name,trigger:batch.trigger,frames:batch.frames.length,renderedFrames,scope:renderedFrames?'rendered':'initial Contents closed; no glass acceptance claimed',issues:contentsMotionProblems(batch)});
  }
}
const missing=process.argv.length>2?Object.entries(witnesses).filter(([,seen])=>!seen).map(([name])=>name):[];
const failed=reports.some(r=>r.issues.length)||missing.length>0;
console.log(JSON.stringify({cases,reports,witnesses,missing,status:failed?'fail':'pass'},null,2));
if(failed)process.exitCode=1;
