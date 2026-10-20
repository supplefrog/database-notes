// Private browser-test observer. Reads actual frames; never drives the product.
export function observeContentsFrames({duration=1400}={}) {
  const panel=document.querySelector('.current-chapter > .chapter-sections');
  if(!panel)throw Error('Actual reader Contents is required');
  const menu=panel.closest('.contents-menu'),links=[...panel.querySelectorAll('a')];
  const frames=[],started=performance.now();
  const round=n=>Math.round(n*1000)/1000;
  return new Promise(resolve=>{
    function sample(time){
      const state=window.notesContentsGlass,canvas=panel.querySelector('canvas');
      const box=panel.getBoundingClientRect(),pseudo=getComputedStyle(menu,'::details-content');
      frames.push({time:round(time-started),width:innerWidth,open:menu.open,opacity:Number(pseudo.opacity),ready:panel.classList.contains('contents-glass-ready'),current:links.findIndex(a=>a.getAttribute('aria-current')==='location'),paint:state?.frames,labels:state?.labelPaints,shape:state?.shape,owner:state?.owner,canvas:canvas?{width:canvas.width,height:canvas.height,hidden:canvas.hidden}:null,rows:links.map(a=>{const r=a.getBoundingClientRect(),s=getComputedStyle(a);return {text:a.textContent,top:round(r.top-box.top),height:round(r.height),width:round(r.width),weight:s.fontWeight,stroke:parseFloat(s.webkitTextStrokeWidth)||0,emphasis:Number(s.getPropertyValue('--contents-emphasis'))||0};})});
      if(time-started<duration)requestAnimationFrame(sample);else resolve({url:location.href,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,frames});
    }
    requestAnimationFrame(sample);
  });
}

// The review server injects this only with ?qc=contents-motion. Its JSON node
// lets the documented read-only browser API retrieve frame evidence without CDP.
if(typeof document!=='undefined'&&new URL(location.href).searchParams.get('qc')==='contents-motion'){
  const output=document.createElement('script');output.id='contents-motion-qc';output.type='application/json';document.body.append(output);
  output.dataset.running='false';output.dataset.sequence='0';
  let running=false,pending=false,sequence=0;const batches=[];
  const start=async event=>{
    if(running){pending=true;return;}
    running=true;output.dataset.running='true';const trigger={type:event?.type||'initial',text:event?.target?.closest?.('a,summary')?.textContent?.trim().slice(0,90)||''};
    const report=await observeContentsFrames();batches.push({sequence:++sequence,trigger,...report});if(batches.length>5)batches.shift();output.textContent=JSON.stringify(batches);output.dataset.sequence=String(sequence);running=false;output.dataset.running='false';
    if(pending){pending=false;start({type:'continued'});}
  };
  for(const type of ['pointerdown','keydown','wheel'])document.addEventListener(type,start,{capture:true,passive:true});
  document.fonts.ready.then(()=>start());
}
