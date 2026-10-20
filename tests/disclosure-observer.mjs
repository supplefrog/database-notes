// Test-only observation of real DOM and actual native input. No product writes.
export function observeDisclosure({duration=900,onFrame=()=>{}}={}){
 const aside=document.querySelector('.reading-aside'),menu=document.querySelector('.contents-menu'),nav=menu.querySelector('nav');
 const groups=[...menu.querySelectorAll('.contents-group')],chapter=menu.querySelector('.current-chapter');
 const start=performance.now(),frames=[],r=n=>Math.round(n*1000)/1000;
 const rect=el=>{const b=el.getBoundingClientRect();return {x:r(b.x),y:r(b.y),w:r(b.width),h:r(b.height)};};
 function frame(time){
  const glass=window.notesContentsGlass,canvas=chapter?.querySelector('canvas'),native=chapter?.querySelector('.chapter-sections');
  return {t:r(time-start),width:innerWidth,height:innerHeight,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,aside:{...rect(aside),client:aside.clientWidth,scroll:aside.scrollHeight,room:aside.clientHeight,top:aside.scrollTop},nav:{...rect(nav),client:nav.clientWidth,scroll:nav.scrollHeight,room:nav.clientHeight,top:nav.scrollTop},menu:{open:menu.open,opacity:Number(getComputedStyle(menu,'::details-content').opacity)},groups:groups.map(d=>{const s=d.querySelector('summary'),p=getComputedStyle(d,'::details-content');return {title:s.textContent,open:d.open,summary:rect(s),opacity:Number(p.opacity),size:parseFloat(p.blockSize)||0,visibility:p.contentVisibility};}),chapter:chapter?rect(chapter):null,panel:native?rect(native):null,glass:glass?{ready:native?.classList.contains('contents-glass-ready'),enabled:glass.enabled,shape:glass.shape,aim:glass.aim,owner:glass.owner,reveal:glass.reveal,surface:glass.surface,frames:glass.frames,labels:glass.labelPaints,allocations:glass.allocations,error:glass.shaderError}:null,canvas:canvas?{...rect(canvas),width:canvas.width,height:canvas.height,hidden:canvas.hidden}:null,rows:[...chapter?.querySelectorAll('.chapter-sections a')||[]].map(a=>({text:a.textContent,...rect(a),weight:getComputedStyle(a).fontWeight,stroke:parseFloat(getComputedStyle(a).webkitTextStrokeWidth)||0,emphasis:Number(a.style.getPropertyValue('--contents-emphasis'))||0})),canvases:chapter?.querySelectorAll('canvas').length||0,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
 }
 // Capture the event's pre-default geometry as well as subsequent painted frames.
 const first=frame(start);frames.push(first);onFrame(first);
 return new Promise(resolve=>{function sample(time){const f=frame(time);frames.push(f);onFrame(f);if(time-start<duration)requestAnimationFrame(sample);else resolve({url:location.href,frames});}requestAnimationFrame(sample);});
}
if(typeof document!=='undefined'&&new URL(location.href).searchParams.get('qc')==='disclosure'){
 const output=document.createElement('script');output.id='contents-disclosure-qc';output.type='application/json';document.body.append(output);output.dataset.running='false';output.dataset.sequence='0';
 let sequence=0,running=false,pending=false;const batches=[];
 async function capture(event){
  if(running){pending=true;return;}
  running=true;output.dataset.running='true';
  const trigger={type:event?.type||'initial',text:event?.target?.closest?.('a,summary')?.textContent?.trim().slice(0,100)||''};
  const report=await observeDisclosure({onFrame:f=>{const p=f.glass?.reveal?.value;output.dataset.bubblePhase=f.glass?.enabled&&p>.08&&p<.9?'forming':'other';}});batches.push({sequence:++sequence,trigger,...report});if(batches.length>5)batches.shift();output.textContent=JSON.stringify(batches);output.dataset.sequence=String(sequence);output.dataset.running='false';running=false;
  if(pending){pending=false;capture({type:'continued'});}
 }
 for(const type of ['pointerdown','keydown','wheel'])document.addEventListener(type,capture,{capture:true,passive:true});
 capture();
}
